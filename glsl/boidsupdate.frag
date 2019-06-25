#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform sampler2D velocity;
uniform sampler2D rand;
uniform int derivative;
uniform vec2 scale;
uniform float random;
uniform float noise;
uniform float interDist;
uniform float boidVel;
uniform bool boundary;
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
    vec4 rand = texture2D(rand, index);
    vec2 avg_v = vec2(0,0);
    vec2 avg_p = vec2(0,0);
    vec2 repl = vec2(0,0);
    float N = 0.;

    for (float x = 0.0; x < 64.; x++) {
        for (float y = 0.0; y < 64.; y++) {
            vec4 pcol = texture2D(position, vec2(x / 64., y / 64.));
            vec2 op = vec2(decode(pcol.rg, scale.x), decode(pcol.ba, scale.x));

            vec4 vcol = texture2D(velocity, vec2(x / 64., y / 64.));
            vec2 ov = vec2(decode(vcol.rg, scale.y), decode(vcol.ba, scale.y));

            if (distance(p,op) < interDist){
                repl -= (op - p);
                avg_v += ov; // calc avg velocity
                avg_p += op; // calc centre of mass
                N += 1.;
            }
        }
    }

    //Add a boundary
    if (boundary){
        repl.x += 0.1*N*exp(-0.1*p.x)*normalize(-p.x);
        repl.y += 0.1*N*exp(-0.1*p.y)*normalize(-p.y);
        repl.x += 0.1*N*exp(0.1*(p.x-worldsize.x))*normalize(worldsize.x-p.x);
        repl.y += 0.1*N*exp(0.1*(p.y-worldsize.y))*normalize(worldsize.y-p.y);
    }
    
    avg_v /= N;
    avg_p /= N;
    repl /= N;

    vec2 v3 = normalize(avg_v); 
    vec2 v2 = 1.01*repl;
    vec2 v1 = (avg_p-p); 
    v += v1+v2+v3;
    v = boidVel*normalize(v)+ noise*vec2(rand.x-0.5,rand.y-0.5);;

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
