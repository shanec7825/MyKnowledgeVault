declare class RequestBodyTooLargeError extends Error {
    readonly maxBytes: number;
    constructor(maxBytes: number);
}
/** Count actual bytes before parsing. A claimed Content-Length never bypasses this bound. */
declare function readRequestBytes(request: Pick<Request, 'body' | 'signal'>, maxBytes: number): Promise<Uint8Array<ArrayBuffer>>;

export { RequestBodyTooLargeError, readRequestBytes };
