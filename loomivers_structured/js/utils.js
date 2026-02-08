export class ObjectPool {
    constructor(fn, size = 100) {
        this.createFn = fn;
        this.pool = [];
        this.active = [];
        for (let i = 0; i < size; i++) {
            this.pool.push(fn());
        }
    }

    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        obj.active = true;
        this.active.push(obj);
        return obj;
    }

    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            obj.active = false;
            this.pool.push(obj);
        }
    }

    reset() {
        while(this.active.length > 0) {
            const obj = this.active.pop();
            obj.active = false;
            this.pool.push(obj);
        }
    }
}

export function checkRectCollide(r1, r2) {
    // V5 Logic: Top-Left x,y + width/height
    const w1 = r1.w || r1.width;
    const h1 = r1.h || r1.height;
    const w2 = r2.w || r2.width;
    const h2 = r2.h || r2.height;

    return (r1.x < r2.x + w2 &&
            r1.x + w1 > r2.x &&
            r1.y < r2.y + h2 &&
            r1.y + h1 > r2.y);
}
