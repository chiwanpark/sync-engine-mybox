export default class RateLimiter {
	private readonly starts: Array<number> = [];
	private readonly queue: Array<() => void> = [];
	private timer: number | undefined;

	constructor(
		private readonly getLimit: () => number,
		private readonly windowMs = 60_000,
	) {}

	acquire(): Promise<void> {
		return new Promise((resolve) => {
			this.queue.push(resolve);
			this.process();
		});
	}

	dispose(): void {
		window.clearTimeout(this.timer);
		this.timer = undefined;
		this.queue.splice(0).forEach((resolve) => resolve());
	}

	private process(): void {
		const now = Date.now();
		while (this.starts.length > 0 && this.starts[0] <= now - this.windowMs) this.starts.shift();
		const limit = Math.max(1, this.getLimit());
		while (this.queue.length > 0 && this.starts.length < limit) {
			this.starts.push(now);
			this.queue.shift()?.();
		}
		if (this.queue.length === 0 || this.timer !== undefined) return;
		const oldest = this.starts[this.starts.length - limit] ?? now;
		this.timer = window.setTimeout(
			() => {
				this.timer = undefined;
				this.process();
			},
			Math.max(0, oldest + this.windowMs - now),
		);
	}
}
