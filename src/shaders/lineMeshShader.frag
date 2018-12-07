#version 300 es
precision highp float;
precision lowp isampler2D;
#define PI 3.1415926535897932384626433832795

uniform sampler2D u_tSample;
uniform sampler2D u_PControls0;
uniform sampler2D u_PControls1;
uniform sampler2D u_PControls2;
uniform sampler2D u_PControls3;
uniform sampler2D u_height;

uniform float threeRadius;
uniform float earthRadius;
uniform vec3 referenceEquiRectangular;
uniform float standardParallel1;
uniform float standardParallel2;
uniform int representationInit;
uniform int representationEnd;
uniform float percentRepresentation;

uniform float coefficient;

#pragma glslify: displayConversions =require(./src/shaders/displayConversions.glsl)
in vec2 pos;
layout(location = 0) out vec4 myOutputColor;

void main() {
  ivec2 pos2 = ivec2(pos);
  ivec2 townPos = ivec2(0, pos2.y);
  float ta = texelFetch(u_tSample, ivec2(pos2.x, 0), 0).r;
  float minusT = 1.0 - ta;
  vec3 p0 = texelFetch(u_PControls0, townPos, 0).xyz;
  vec3 p1 = texelFetch(u_PControls1, townPos, 0).xyz;
  vec3 p2 = texelFetch(u_PControls2, townPos, 0).xyz;
  vec3 p3 = texelFetch(u_PControls3, townPos, 0).xyz;
  p1.z = texelFetch(u_height, townPos, 0).x;
  p2.z = p1.z;

  vec3 cartoPosition = pow(minusT, 3.0) * p0 + 3.0 * pow(minusT, 2.0) * ta * p1 +
                       3.0 * minusT * pow(ta, 2.0) * p2 + pow(ta, 3.0) * p3;

  vec3 modelPosition = displayConversions(
      cartoPosition, threeRadius, earthRadius, referenceEquiRectangular,standardParallel1,standardParallel2,
      representationInit, representationEnd, percentRepresentation);
  myOutputColor = vec4(modelPosition, 0.0);
}
