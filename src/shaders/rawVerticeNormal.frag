#version 300 es
precision highp float;

uniform sampler2D points;
in vec2 pos;

layout(location = 0) out vec4 normal;

vec3 rawNormal(int width) {
  vec3 resultat = vec3(0.0);
  ivec2 pos2 = ivec2(pos);
  int x = pos2.x;
  int y = pos2.y;
  // summit
  pos2.x = width - 2;
  vec3 summit = texelFetch(points, pos2, 0).xyz;
  // below
  pos2.x = width - 1;
  vec3 below = texelFetch(points, pos2, 0).xyz;
  // concerned
  pos2.x = x;
  vec3 center = texelFetch(points, pos2, 0).xyz;
  // left
  pos2.x = x == 0 ? width - 3 : x;
  vec3 left = texelFetch(points, pos2, 0).xyz;
  // right
  pos2.x = x >= width - 3 ? 0 : x;
  vec3 right = texelFetch(points, pos2, 0).xyz;

  vec3 centerSummit;
  vec3 centerBelow;
  if (x < width - 2) {
    centerSummit = center - summit;
    centerBelow = center - below;
    resultat = cross(left - summit, centerSummit) +
               cross(centerSummit, right - summit) +
               cross(left - below, centerBelow) +
               cross(centerBelow, right - below);
    if (length(resultat) < 0.0000001) {
      resultat.x = 1.0;
    }
  }
  return resultat;
}

void main() {
  int width = textureSize(points, 0).x;
  normal = vec4(rawNormal(width), 0.0);
}
