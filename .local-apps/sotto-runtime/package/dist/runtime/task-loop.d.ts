interface TaskLoopOptions {
    intervalMs: number;
    signal: AbortSignal;
    task: (signal: AbortSignal) => void | Promise<void>;
    onError: (error: unknown) => undefined;
}
/**
 * Run immediately, then wait after each completed pass. Tasks never overlap.
 * The caller owns cancellation and must await or observe this promise.
 * Abort stops scheduling and waits for active work to finish cooperatively.
 * A throwing error reporter terminates the loop by rejecting its promise.
 */
declare function runTaskLoop(options: TaskLoopOptions): Promise<void>;

export { type TaskLoopOptions, runTaskLoop };
