import { createApp } from 'vue';
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

    // setting reference to current class
    const that = this;

    // Create recording wrapper view
    const viewModel = createApp({
      ...AudioRecorderView,
      components: {
        timer: Timer,
        vuMeter: VUMeter
      }
    }, {
      // Start recording when record button is pressed
      onRecording() {
        recorder.start();
      },
      onDone() {
        recorder.stop();
        recorder.getWavURL().then(blob => {
          recorder.releaseMic();
  
          media = {
            data: blob,
            name: 'audio-recorder.' + blob.type.split('/')[1]
          };
  
          vm.$data.audioSrc = URL.createObjectURL(blob);
  
          that.trigger('hasMedia', true);
        }).catch(e => {
          vm.$data.state = State.CANT_CREATE_AUDIO_FILE;
          console.error(H5PEditor.t('H5PEditor.AudioRecorder', 'statusCantCreateTheAudioFile'), e);
        });
      },
      onRetry() {
        recorder.releaseMic();
        vm.$data.audioSrc = AUDIO_SRC_NOT_SPECIFIED;
        that.trigger('hasMedia', false);
        media = undefined;
      },
      onPaused() {
        recorder.stop();
      },
      // resize iframe on state change
      onResize() {
        that.trigger('resize')
      }
    });

    let vm;

    let media;
    this.getMedia = function () {
      return media;
    };
    this.hasMedia = function () {
      return !!media;
    };
    this.reset = function () {
      if (recorder.supported()) {
        vm.$data.state = State.READY;
        if (vm.$refs.timer) {
          vm.$refs.timer.reset();
        }
        vm.$emit('retry');
      }
    };
    this.pause = function () {
      if (recorder.supported() && vm.$data.state === 'recording') {
        vm.$data.state = State.PAUSED;
        vm.$emit('paused');
      }
    };

    // Update UI when on recording events
    recorder.on('recording', () => {
      vm.$data.state = State.RECORDING;

      // Start update loop for microphone frequency
      this.updateMicFrequency();
    });

    // Blocked probably means user has no mic, or has not allowed access to one
    recorder.on('blocked', () => {
      vm.$data.state = State.BLOCKED;
    });

    // May be sent from Chrome, which don't allow use of mic when using http (need https)
    recorder.on('insecure-not-allowed', () => {
      vm.$data.state = State.INSECURE_NOT_ALLOWED;
    });

    /**
     * Initialize microphone frequency update loop. Will run until no longer recording.
     */
    this.updateMicFrequency = function () {
      // Stop updating if no longer recording
      if (vm.$data.state !== State.RECORDING) {
        window.cancelAnimationFrame(this.animateVUMeter);
        return;
      }

      // Grab average microphone frequency
      vm.$data.avgMicFrequency = recorder.getAverageMicFrequency();

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
      vm = viewModel.mount(rootElement);
    };
  }
}
