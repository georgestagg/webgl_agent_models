function Particles(canvas, nparticles) {
    var igloo = this.igloo = new Igloo(canvas),
        gl = igloo.gl,
        w = canvas.width, h = canvas.height;
    gl.disable(gl.DEPTH_TEST);

    this.worldsize = new Float32Array([w, h]);
    var scale = Math.floor(Math.pow(Particles.BASE, 2) / Math.max(w, h) / 3);
    this.scale = [scale, scale * 100];
    this.listeners = [];

    /* Vertex shader texture access not guaranteed on OpenGL ES 2.0. */
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) === 0) {
        var msg = 'Vertex shader texture access not available.' +
                'Try again on another platform.';
        alert(msg);
        throw new Error(msg);
    }

    /* Drawing parameters. */
    this.pointSize = 3;

    /* Simulation parameters. */
    this.running = false;
    this.prefVel = 5.0;
    this.replSigma = 30;
    this.noise = 0.5;
    this.R0 = 0.1;
    this.G0 = 0.8;
    this.goal = [this.worldsize[0]/2, this.worldsize[1]/2];
    this.enableGoal = true;
    this.goalType = 'center';
    this.framecount = 0;

    function texture() {
        return igloo.texture(null, gl.RGBA, gl.CLAMP_TO_EDGE, gl.NEAREST);
    }

    this.programs = {
        update:  igloo.program('glsl/quad.vert', 'glsl/update.frag'),
        draw:    igloo.program('glsl/draw.vert', 'glsl/draw.frag')
    };
    this.buffers = {
        quad: igloo.array(Igloo.QUAD2),
        indexes: igloo.array(),
        point: igloo.array(new Float32Array([0, 0]))
    };
    this.textures = {
        p0: texture(),
        p1: texture(),
        v0: texture(),
        v1: texture(),
        rand: texture()
    };
    this.framebuffers = {
        step: igloo.framebuffer()
    };

    this.setCount(nparticles, true);
}

/**
 * Encoding base.
 * @type {number}
 * @const
 */
Particles.BASE = 255;

/**
 * @param {number} value
 * @param {number} scale to maximize use of dynamic range
 * @returns {Array} the 2-byte encoding of VALUE
 */
Particles.encode = function(value, scale) {
    var b = Particles.BASE;
    value = value * scale + b * b / 2;
    var pair = [
        Math.floor((value % b) / b * 255),
        Math.floor(Math.floor(value / b) / b * 255)
    ];
    return pair;
};

/**
 * @param {Array} pair
 * @param {number} scale to maximize use of dynamic range
 * @returns {number} the value for the encoded PAIR
 */
Particles.decode = function(pair, scale) {
    var b = Particles.BASE;
    return (((pair[0] / 255) * b +
             (pair[1] / 255) * b * b) - b * b / 2) / scale;
};

/**
 * Allocates textures and fills them with initial random state.
 * @returns {Particles} this
 */
Particles.prototype.initTextures = function() {
    var tw = this.statesize[0], th = this.statesize[1],
        w = this.worldsize[0], h = this.worldsize[1],
        s = this.scale,
        rgbaP = new Uint8Array(tw * th * 4),
        rgbaV = new Uint8Array(tw * th * 4);
    for (var y = 0; y < th; y++) {
        for (var x = 0; x < tw; x++) {
            var i = y * tw * 4 + x * 4,
                px = Particles.encode(Math.random() * w, s[0]),
                py = Particles.encode(Math.random() * h, s[0]),
                vx = Particles.encode(Math.random() * 10 - 5, s[1]),
                vy = Particles.encode(Math.random() * 10 - 5, s[1]);
            rgbaP[i + 0] = px[0];
            rgbaP[i + 1] = px[1];
            rgbaP[i + 2] = py[0];
            rgbaP[i + 3] = py[1];
            rgbaV[i + 0] = vx[0];
            rgbaV[i + 1] = vx[1];
            rgbaV[i + 2] = vy[0];
            rgbaV[i + 3] = vy[1];
        }
    }
    this.textures.p0.set(rgbaP, tw, th);
    this.textures.v0.set(rgbaV, tw, th);
    this.textures.rand.set(rgbaP, tw, th);
    this.textures.p1.blank(tw, th);
    this.textures.v1.blank(tw, th);
    return this;
};

Particles.prototype.setRand = function() {
    var tw = this.statesize[0], th = this.statesize[1],
        w = this.worldsize[0], h = this.worldsize[1],
        s = this.scale,
        rgbaP = new Uint8Array(tw * th * 4);
    for (var y = 0; y < th; y++) {
        for (var x = 0; x < tw; x++) {
            var i = y * tw * 4 + x * 4;
            rgbaP[i + 0] = Math.random()*255;
            rgbaP[i + 1] = Math.random()*255;
            rgbaP[i + 2] = Math.random()*255;
            rgbaP[i + 3] = Math.random()*255;
        }
    }
    this.textures.rand.set(rgbaP, tw, th);
    return this;
};

/**
 * Allocate array buffers and fill with needed values.
 * @returns {Particles} this
 */
Particles.prototype.initBuffers = function() {
    var tw = this.statesize[0], th = this.statesize[1],
        gl = this.igloo.gl,
        indexes = new Float32Array(tw * th * 2);
    for (var y = 0; y < th; y++) {
        for (var x = 0; x < tw; x++) {
            var i = y * tw * 2 + x * 2;
            indexes[i + 0] = x;
            indexes[i + 1] = y;
        }
    }
    this.buffers.indexes.update(indexes, gl.STATIC_DRAW);
    return this;
};

/**
 * Set a new particle count. This is a minimum and the actual count
 * may be slightly higher to fill out a texture.
 * @param {number} n
 * @returns {Particles} this
 */
Particles.prototype.setCount = function(n) {
    var tw = Math.ceil(Math.sqrt(n)),
        th = Math.floor(Math.sqrt(n));
    this.statesize = new Float32Array([64, 64]);
    this.initTextures();
    this.initBuffers();
    return this;
};

/**
 * @returns {number} the actual particle count
 */
Particles.prototype.getCount = function() {
    return this.statesize[0] * this.statesize[1];
};

/**
 * @returns {Array} list of all particle positions
 */
Particles.prototype.get = function() {
    var gl = this.igloo.gl;
    this.framebuffers.step.attach(this.textures.p0);
    var w = this.statesize[0], h = this.statesize[1],
        s = this.scale,
        rgba = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    var particles = [];
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var i = y * w * 4 + x * 4,
                px = Particles.decode([rgba[i + 0], rgba[i + 1]], s[0]),
                py = Particles.decode([rgba[i + 2], rgba[i + 3]], s[0]);
            particles.push({x: px, y: py});
        }
    }
    return particles;
};

/**
 * Swap the foreground and background state.
 * @returns {Particles} this
 */
Particles.prototype.swap = function() {
    var tmp = this.textures.p0;
    this.textures.p0 = this.textures.p1;
    this.textures.p1 = tmp;
    tmp = this.textures.v0;
    this.textures.v0 = this.textures.v1;
    this.textures.v1 = tmp;
    return this;
};

/**
 * Step the simulation forward by one iteration.
 * @returns {Particles} this
 */
Particles.prototype.step = function() {
    var igloo = this.igloo, gl = igloo.gl;
    gl.disable(gl.BLEND);
    this.setRand();
    this.framebuffers.step.attach(this.textures.p1);
    this.textures.p0.bind(0);
    this.textures.v0.bind(1);
    this.textures.rand.bind(2);
    gl.viewport(0, 0, this.statesize[0], this.statesize[1]);
    this.programs.update.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniformi('position', 0)
        .uniformi('velocity', 1)
        .uniformi('rand', 2)
        .uniform('scale', this.scale)
        .uniform('random', Math.random() * 2.0 - 1.0)
        .uniform('goal', this.goal)
        .uniform('enableGoal', this.enableGoal)
        .uniform('prefVel', this.prefVel)
        .uniform('R0', this.R0)
        .uniform('G0', this.G0)
        .uniform('replSigma',this.replSigma)
        .uniform('noise',this.noise)
        .uniform('worldsize', this.worldsize)
        .uniformi('derivative', 0)
        .draw(gl.TRIANGLE_STRIP, Igloo.QUAD2.length / 2);
    this.framebuffers.step.attach(this.textures.v1);
    this.programs.update
        .uniformi('derivative', 1)
        .uniform('random', Math.random() * 2.0 - 1.0)
        .draw(gl.TRIANGLE_STRIP, Igloo.QUAD2.length / 2);
    this.swap();
    return this;
};

/**
 * Draw the current simulation state to the display.
 * @returns {Particles} this
 */
Particles.prototype.draw = function() {
    var igloo = this.igloo, gl = igloo.gl;
    gl.enable(gl.BLEND);
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFunc(gl.ONE, gl.ONE);
    igloo.defaultFramebuffer.bind();
    gl.viewport(0, 0, this.worldsize[0], this.worldsize[1]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.textures.p0.bind(0);
    this.textures.v0.bind(1);
    this.programs.draw.use()
        .attrib('index', this.buffers.indexes, 2)
        .uniformi('positions', 0)
        .uniformi('velocities', 1)
        .uniform('statesize', this.statesize)
        .uniform('worldsize', this.worldsize)
        .uniform('size', this.pointSize)
        .uniform('scale', this.scale)
        .draw(gl.POINTS, this.statesize[0] * this.statesize[1]);
    return this;
};

/**
 * Register with requestAnimationFrame to step and draw a frame.
 * @returns {Particles} this
 */
Particles.prototype.frame = function() {
    window.requestAnimationFrame(function() {
        if (this.running) {
            this.step().draw().frame();
            for (var i = 0; i < this.listeners.length; i++) {
                this.listeners[i]();
            }
            this.framecount++;
            if (this.goalType == 'circle'){
                this.goal = [
                (this.worldsize[0]/2)+(this.worldsize[0]/10)*Math.cos(this.framecount/10), 
                (this.worldsize[1]/2)+(this.worldsize[0]/10)*Math.sin(this.framecount/10)];
            } else if (this.goalType == 'center'){
                this.goal = [this.worldsize[0]/2, this.worldsize[1]/2];
            }

        }
    }.bind(this));
    return this;
};

/**
 * Start animating the simulation if it isn't already.
 * @returns {Particles} this
 */
Particles.prototype.start = function() {
    if (!this.running) {
        this.running = true;
        this.frame();
    }
    return this;
};

/**
 * Immediately stop the animation.
 * @returns {Particles} this
 */
Particles.prototype.stop = function() {
    this.running = false;
    return this;
};

Particles.prototype.resizeCanvas = function() {
    return this;
};

moveGoal= function(event) {
    mouseX = event.pageX + document.body.scrollLeft;
    mouseY = event.pageY + document.body.scrollTop;
    if (am.goalType == 'followMouse'){
        am.goal = [mouseX,(am.worldsize[1]-mouseY)];
    }
};

var canvas = document.getElementById('AM');
this.canvas.width = window.innerWidth;
this.canvas.height = window.innerHeight;
var am = new Particles(canvas, 64*64).draw().start();
canvas.addEventListener("mousemove", moveGoal);

var gui = new dat.GUI();
var pfm = gui.addFolder('Pedestrian Force Model');
pfm.add(am, 'prefVel',0,15).step(0.5);
pfm.add(am, 'replSigma',0,100).step(5);
pfm.add(am, 'R0',0,0.5).step(0.01);
pfm.add(am, 'G0',0,1.5).step(0.05);
pfm.open();
gui.add(am, 'enableGoal');
gui.add(am, 'goalType', ['followMouse', 'center', 'circle']);
gui.add(am, 'pointSize',1,10).step(0.5);
gui.add(am, 'noise',0,10).step(0.5);
