vec3 noRepresentation(in vec3 pos, in float threeRadius, in float earthRadius) {
  float radius = (earthRadius + pos.z) / earthRadius * threeRadius;
  vec3 resultat = vec3(0.0);
  resultat.x = -cos(pos.x) * radius * cos(pos.y);
  resultat.y = sin(pos.y) * radius;
  resultat.z = sin(pos.x) * radius * cos(pos.y);
  return resultat;
}

vec3 equirectangular(in vec3 pos, in float threeRadius, in float earthRadius,
                     in vec3 reference) {
  vec3 resultat = vec3(0.0);
  resultat.x = (pos.x - reference.x) * cos(reference.y) * threeRadius;
  resultat.y = (pos.y - reference.y) * threeRadius;
  resultat.z = (pos.z - reference.z) / earthRadius * threeRadius;
  return resultat;
}

vec3 mercator(in vec3 pos, in float threeRadius, in float earthRadius,
              in float lambda0) {
  vec3 resultat = vec3(0.0);
  resultat.x = (pos.x - lambda0) * threeRadius;
  resultat.y = log(tan(PI / 4.0 + pos.y / 2.0)) * threeRadius;
  resultat.z = pos.z / earthRadius * threeRadius;
  return resultat;
}

vec3 convertor(in vec3 pos, in float threeRadius, in float earthRadius,
               in vec3 reference, in float lambda0, int representation) {
  vec3 resultat;
  if (representation == 0) {
    resultat = noRepresentation(pos, threeRadius, earthRadius);
  } else if (representation == 1) {
    resultat = equirectangular(pos, threeRadius, earthRadius, reference);
  } else {
    resultat = mercator(pos, threeRadius, earthRadius, lambda0);
  }
  return resultat;
}

vec3 transit(in vec3 pos, in float threeRadius, in float earthRadius,
             in vec3 reference, in float lambda0, in int representationInit,
             in int representationEnd, in float percent) {
  vec3 resultat;
  if (representationInit == representationEnd) {
    resultat = convertor(pos, threeRadius, earthRadius, reference, lambda0,
                         representationInit);
  } else {
    vec3 initVec = convertor(pos, threeRadius, earthRadius, reference, lambda0,
                             representationInit);
    vec3 endVec = convertor(pos, threeRadius, earthRadius, reference, lambda0,
                            representationEnd);
    resultat = mix(initVec, endVec, percent / 100.0);
  }
  return resultat;
}

#pragma glslify: export(transit)
