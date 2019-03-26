#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform sampler2D velocity;
uniform sampler2D rand;
uniform int derivative;
uniform vec2 scale;
uniform float random;
uniform float R0;
uniform float G0;
uniform vec2 goal;
uniform bool enableGoal;
uniform float prefVel;
uniform float replSigma;
uniform float noise;
uniform vec2 worldsize;
varying vec2 index;

const float BASE = 255.0;
const float OFFSET = BASE * BASE / 2.0;

float decode(vec2 channels, float scale) {
    return (dot(channels, vec2(BASE, BASE * BASE)) - OFFSET) / scale;
}

vec2 encode(float value, float scale) {
    value = value * scale + OFFSET;
    float x = mod(value, BASE);
    float y = floor(value / BASE);
    return vec2(x, y) / BASE;
}

void updatePosition(inout vec2 p, inout vec2 v) {
    p += v;
}

void updateVelocity(inout vec2 p, inout vec2 v) {
    vec2 op;
    vec4 tcol;
    vec2 repul = vec2(0,0);
    vec4 rand = texture2D(rand, index);
    for (float x = 0.0; x < 64.; x++) {
        for (float y = 0.0; y < 64.; y++) {
            tcol = texture2D(position, vec2(x / 64., y / 64.));
            op = vec2(decode(tcol.rg, scale.x), decode(tcol.ba, scale.x));
            repul += R0*exp(-distance(p,op)/replSigma)*normalize(p-op);
        }
    }

    if (enableGoal) {
        v+= G0*(prefVel*normalize(goal-p) - v);
    }
    v += repul + noise*vec2(rand.x-0.5,rand.y-0.5);
}

void main() {
    vec4 psample = texture2D(position, index);
    vec4 vsample = texture2D(velocity, index);
    vec2 p = vec2(decode(psample.rg, scale.x), decode(psample.ba, scale.x));
    vec2 v = vec2(decode(vsample.rg, scale.y), decode(vsample.ba, scale.y));
    vec2 result;
    float s;
    if (derivative == 0) {
        updatePosition(p, v);
        result = p;
        s = scale.x;
    } else {
        updateVelocity(p, v);
        result = v;
        s = scale.y;
    }
    gl_FragColor = vec4(encode(result.x, s), encode(result.y, s));
}
