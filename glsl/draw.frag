#ifdef GL_ES
precision highp float;
#endif

uniform vec4 color;
varying vec2 velocity;

const float DELTA = 0.2;

void main() {
    vec3 color1 = vec3(0.226,0.000,0.9);
    vec3 color2 = vec3(1.9,0.55,0);
    float mixValue = length(velocity)/5.0;
    vec3 color = mix(color1,color2,mixValue);

    vec2 p = 2.0 * (gl_PointCoord - 0.5);
    float a = smoothstep(1.0 - DELTA, 1.0, length(p));

    gl_FragColor = mix(vec4(color,1.0), vec4(0, 0, 0, 0), a);
}
