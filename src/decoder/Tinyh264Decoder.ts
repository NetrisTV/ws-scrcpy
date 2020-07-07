// @ts-ignore
import Worker from '../tinyh264/H264NALDecoder.worker'
import Decoder from "./Decoder";
import VideoSettings from "../VideoSettings";
import ScreenInfo from "../ScreenInfo";
import YUVWebGLCanvas from "../tinyh264/YUVWebGLCanvas";
import YUVCanvas from "../tinyh264/YUVCanvas";

type WorkerMessage = {
  type: string;
  width: number;
  height: number;
  data: ArrayBuffer;
  renderStateId: number;
}

export default class Tinyh264Decoder extends Decoder {
  private static videoStreamId = 1;
  public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 500000,
    frameRate: 24,
    iFrameInterval: 5,
    maxSize: 480,
    sendFrameMeta: false
  });

  public static createElement(id?: string): HTMLCanvasElement {
    const tag = document.createElement('canvas') as HTMLCanvasElement;
    if (typeof id === 'string') {
      tag.id = id;
    }
    tag.className = 'video-layer';

    return tag;
  }

  protected TAG: string = 'Tinyh264Decoder';
  private worker?: Worker;
  private display?: YUVWebGLCanvas | YUVCanvas;
  private framesList: Uint8Array[] = [];
  private running: boolean = false;
  private readonly bindedOnMessage: (e: MessageEvent) => void;
  private isDecoderReady: boolean = false;

  constructor(protected tag: HTMLCanvasElement) {
    super(tag);
    this.bindedOnMessage = this.onWorkerMessage.bind(this);
  }

  private static isIFrame(frame: Uint8Array): boolean {
    return frame && frame.length > 4 && frame[4] === 0x65;
  }

  private onWorkerMessage(e: MessageEvent): void {
    const message: WorkerMessage = e.data
    switch (message.type) {
      case 'pictureReady':
        const { width, height, data } = message;
        if (this.display) {
          this.display.decode(new Uint8Array(data), width, height);
        }
        break
      case 'decoderReady':
        console.log(this.TAG, message.type);
        this.isDecoderReady = true;
        break
      default:
        console.error(this.TAG, Error(`Wrong message type "${message.type}"`));
    }
  }

  private initWorker(): void {
    this.worker = new Worker();
    this.worker.addEventListener('message', this.bindedOnMessage)
  }

  private initCanvas(width: number, height: number): void {
    if (this.display) {
      const parent = this.tag.parentNode;
      if (parent) {
        const tag = Tinyh264Decoder.createElement(this.tag.id);
        tag.className = this.tag.className;
        parent.replaceChild(tag, this.tag);
        parent.appendChild(this.touchableCanvas);
        this.tag = tag;
      }
    }

    if (Decoder.hasWebGLSupport()) {
      console.log(this.TAG, 'initCanvas', 'WebGl');
      this.display = new YUVWebGLCanvas(this.tag);
    } else {
      console.log(this.TAG, 'initCanvas', '2d');
      this.display = new YUVCanvas(this.tag);
    }
    this.tag.onerror = function(e: Event | string): void {
      console.error(e);
    };
    this.tag.oncontextmenu = function(e: MouseEvent): void {
      e.preventDefault();
    };
    this.tag.width = width;
    this.tag.height = height;
  }

  private shiftFrame(): void {
    this.updateFps(false);
    if (!this.running) {
      return;
    }

    const frame = this.framesList.shift();

    if (frame) {
      this.decode(frame);
      this.updateFps(true);
    }

    requestAnimationFrame(this.shiftFrame.bind(this));
  }

  private decode(data: Uint8Array): void {
    if (!this.worker || !this.isDecoderReady) {
      return;
    }

    this.worker.postMessage({
      type: 'decode',
      data: data.buffer,
      offset: data.byteOffset,
      length: data.byteLength,
      renderStateId: Tinyh264Decoder.videoStreamId
    }, [data.buffer]);
  }

  public play(): void {
    super.play();
    if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
      return;
    }
    if (!this.display) {
      const {width, height} = this.screenInfo.videoSize;
      this.initCanvas(width, height);
    }
    if (!this.worker) {
      this.initWorker();
    }
    this.running = true;
    requestAnimationFrame(this.shiftFrame.bind(this));
  }

  public stop(): void {
    super.stop();
    this.clearState();
    if (this.worker) {
      this.worker.worker.removeEventListener('message', this.bindedOnMessage);
      this.worker.postMessage({type: 'release', renderStateId: Tinyh264Decoder.videoStreamId});
      delete this.worker;
    }
  }

  public setScreenInfo(screenInfo: ScreenInfo): void {
    super.setScreenInfo(screenInfo);
    this.clearState();
    const {width, height} = screenInfo.videoSize;
    this.initCanvas(width, height);
  }

  public getPreferredVideoSetting(): VideoSettings {
    return Tinyh264Decoder.preferredVideoSettings;
  }

  public pushFrame(frame: Uint8Array): void {
    if (Tinyh264Decoder.isIFrame(frame)) {
      if (this.videoSettings) {
        const {frameRate} = this.videoSettings;
        if (this.framesList.length > frameRate / 2) {
          console.log(this.TAG, 'Dropping frames', this.framesList.length);
          this.framesList = [];
        }
      }
    }
    this.framesList.push(frame);
  }

  private clearState(): void {
    this.framesList = [];
    if (this.worker) {
      this.worker.postMessage({type: 'release', renderStateId: Tinyh264Decoder.videoStreamId});
      Tinyh264Decoder.videoStreamId++;
    }
  }
}
