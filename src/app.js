import Vue from 'vue';
import AudioRecorderView from './views/AudioRecorder.vue';
import VUMeter from './views/VUMeter.vue';
import Timer from './views/Timer.vue';
import Recorder from 'components/Recorder';
import State from 'components/State';

const AUDIO_SRC_NOT_SPECIFIED = '';

export default class {

  /**
   * @typedef {Object} Parameters
   *
   * @property {string} title Title
   * @property {Object} l10n Translations
   * @property {string} l10n.download Download button text
   * @property {string} l10n.retry Retry button text
   * @property {string} l10n.finishedRecording Done recording audio
   * @property {string} l10n.microphoneInaccessible Microphone blocked
   * @property {string} l10n.downloadRecording Download recording message
   */

  /**
   * @constructor
   */
  constructor() {
    H5P.EventDispatcher.call(this);
    const rootElement = document.createElement('div');
    rootElement.classList.add('h5p-audio-recorder');

    const recorder = this.recorder = new Recorder();

    const statusMessages = {};
    statusMessages[State.UNSUPPORTED] = H5PEditor.t('H5PEditor.AudioRecorder', 'microphoneNotSupported');
    statusMessages[State.BLOCKED] = H5PEditor.t('H5PEditor.AudioRecorder', 'microphoneInaccessible');
    statusMessages[State.READY] = H5PEditor.t('H5PEditor.AudioRecorder', 'statusReadyToRecord');
    statusMessages[State.RECORDING] = H5PEditor.t('H5PEditor.AudioRecorder', 'statusRecording');
    statusMessages[State.PAUSED] = H5PEditor.t('H5PEditor.AudioRecorder', 'statusPaused');
    statusMessages[State.DONE] = H5PEditor.t('H5PEditor.AudioRecorder', 'statusFinishedRecording');
    statusMessages[State.INSECURE_NOT_ALLOWED] = H5PEditor.t('H5PEditor.AudioRecorder', 'insecureNotAllowed');
    statusMessages[State.CANT_CREATE_AUDIO_FILE] = H5PEditor.t('H5PEditor.AudioRecorder', 'statusCantCreateTheAudioFile');

    AudioRecorderView.data = () => ({
      state: recorder.supported() ? State.READY : State.UNSUPPORTED,
      statusMessages,
      l10n: {
        downloadRecording: H5PEditor.t('H5PEditor.AudioRecorder', 'downloadRecording'),
        recordAnswer: H5PEditor.t('H5PEditor.AudioRecorder', 'recordAnswer'),
        retry: H5PEditor.t('H5PEditor.AudioRecorder', 'retry'),
        pause: H5PEditor.t('H5PEditor.AudioRecorder', 'pause'),
        continue: H5PEditor.t('H5PEditor.AudioRecorder', 'continue'),
        done: H5PEditor.t('H5PEditor.AudioRecorder', 'done'),
        download: H5PEditor.t('H5PEditor.AudioRecorder', 'download')
      },
      audioSrc: AUDIO_SRC_NOT_SPECIFIED,
      audioFilename: '',
      avgMicFrequency: 0
    });

    // Create recording wrapper view
    const viewModel = new Vue({
      ...AudioRecorderView,
      components: {
        timer: Timer,
        vuMeter: VUMeter
      }
    });

    let media;
    this.getMedia = function () {
      return media;
    };
    this.hasMedia = function () {
      return !!media;
    };
    this.reset = function () {
      viewModel.state = State.READY;
      if (viewModel.$refs.timer) {
        viewModel.$refs.timer.reset();
      }
      viewModel.$emit('retry');
    };
    this.pause = function () {
      if (viewModel.state === 'recording') {
        viewModel.state = State.PAUSED;
        viewModel.$emit('paused');
      }
    };

    // Start recording when record button is pressed
    viewModel.$on('recording', () => {
      recorder.start();
    });

    viewModel.$on('done', () => {
      recorder.stop();
      recorder.getWavURL().then(blob => {
        recorder.releaseMic();

        media = {
          data: blob,
          name: 'audio-recorder.' + blob.type.split('/')[1]
        };

        viewModel.audioSrc = URL.createObjectURL(blob);

        this.trigger('hasMedia', true);
      }).catch(e => {
        viewModel.state = State.CANT_CREATE_AUDIO_FILE;
        console.error(H5PEditor.t('H5PEditor.AudioRecorder', 'statusCantCreateTheAudioFile'), e);
      });
    });

    viewModel.$on('retry', () => {
      recorder.releaseMic();
      viewModel.audioSrc = AUDIO_SRC_NOT_SPECIFIED;
      this.trigger('hasMedia', false);
    });

    viewModel.$on('paused', () => {
      recorder.stop();
    });

    // Update UI when on recording events
    recorder.on('recording', () => {
      viewModel.state = State.RECORDING;

      // Start update loop for microphone frequency
      this.updateMicFrequency();
    });

    // Blocked probably means user has no mic, or has not allowed access to one
    recorder.on('blocked', () => {
      viewModel.state = State.BLOCKED;
    });

    // May be sent from Chrome, which don't allow use of mic when using http (need https)
    recorder.on('insecure-not-allowed', () => {
      viewModel.state = State.INSECURE_NOT_ALLOWED;
    });

    /**
     * Initialize microphone frequency update loop. Will run until no longer recording.
     */
    this.updateMicFrequency = function () {
      // Stop updating if no longer recording
      if (viewModel.state !== State.RECORDING) {
        window.cancelAnimationFrame(this.animateVUMeter);
        return;
      }

      // Grab average microphone frequency
      viewModel.avgMicFrequency = recorder.getAverageMicFrequency();

      // Throttle updating slightly
      setTimeout(() => {
        this.animateVUMeter = window.requestAnimationFrame(() => {
          this.updateMicFrequency();
        });
      }, 10)
    };

    /**
     * Attach library to wrapper
     *
     * @param {Element} container
     */
    this.appendTo = function (container) {
      container.appendChild(rootElement);
      viewModel.$mount(rootElement);
    };
  }
}
