#version 300 es
precision highp float;

uniform sampler2D points;
in vec2 pos;

layout(location = 0) out vec4 sphere;
layout(location = 1) out vec4 middlePoint;

void main() {
  int width = textureSize(points, 0).x;

  sphere = vec4(0.0);
  middlePoint = vec4(0.0);
  ivec2 pos2 = ivec2(pos);
  vec3 temp;
  vec3 minimum = vec3(3.402823466e+38);
  vec3 maximum = vec3(-3.402823466e+38);
  // center first!
  for (int i = 0; i < width; i++) {
    pos2.x = i;
    temp = texelFetch(points, pos2, 0).xyz;
    minimum = min(temp, minimum);
    maximum = max(temp, maximum);
    middlePoint.xyz += temp;
  }
  sphere.xyz = (minimum + maximum) / 2.0;
  pos2.x = width - 1;
  temp = texelFetch(points, pos2, 0).xyz;
  middlePoint.xyz = (middlePoint.xyz - temp) / (float(width) - 1.0);
  // radius finally
  for (int i = 0; i < width; i++) {
    pos2.x = i;
    temp = texelFetch(points, pos2, 0).xyz;
    sphere.w = max(sphere.w, distance(sphere.xyz, temp));
  }
}
