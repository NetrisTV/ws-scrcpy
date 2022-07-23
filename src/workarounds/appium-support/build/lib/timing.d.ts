export class Duration {}

export class Timer {
    get startTime(): number;
    public start(): Timer;
    getDuration(): Duration;
}

export default Timer;
