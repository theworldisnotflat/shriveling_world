#version 300 es
precision highp float;

uniform sampler2D points;
uniform sampler2D rawNormals;

layout(location = 0) out vec4 normal;
in vec2 pos;

vec3 getNormal(in ivec2 pos2, in vec3 center, in int x, in int width) {
  // concerned
  pos2.x = x;
  vec3 target = texelFetch(points, pos2, 0).xyz;
  // left
  pos2.x = x == 0 ? width - 3 : x;
  vec3 left = texelFetch(points, pos2, 0).xyz;

  return cross(left - center, target - center);
}

void main() {
  int width = textureSize(points, 0).x;
  ivec2 pos2 = ivec2(pos);
  int x = pos2.x;
  vec3 resultat = vec3(0.0);
  vec3 position = texelFetch(points, pos2, 0).xyz;
  if (x >= width - 2) { // below and summit
    for (int i = 0; i < width - 2; i++) {
      pos2.x = i;
      resultat = resultat + getNormal(pos2, position, x, width);
    }
    resultat = normalize(resultat);
  } else { // others
    resultat = normalize(texelFetch(rawNormals, pos2, 0).xyz);
  }
  normal = vec4(resultat, 0.0);
}
