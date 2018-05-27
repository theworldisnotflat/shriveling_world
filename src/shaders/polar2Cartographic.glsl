vec3 project(in float clock, in float elevation, in float longeur,
             in vec3 summit, in mat3 ned2ECEF, in float earthRadius) {
  float radius = earthRadius + summit.z;
  vec3 ecefSummit =
      vec3(cos(summit.x) * radius * cos(summit.y),
           sin(summit.x) * radius * cos(summit.y), sin(summit.y) * radius);

  float cosEl = cos(elevation);
  float sinEl = sin(elevation);
  float cosClock = cos(clock);
  float sinClock = sin(clock);
  vec3 nedProjection =
      longeur * vec3(cosEl * cosClock, cosEl * sinClock, sinEl);
  vec3 temp = ned2ECEF * nedProjection + ecefSummit;
  radius = length(temp);
  vec3 resultat = vec3(0.0);
  resultat.z = radius - earthRadius;
  if (radius > 0.0) {
    resultat.x = atan(temp.y, temp.x);
    float sinus = sin(resultat.x);
    if (abs(sinus) > 0.000000000001) {
      resultat.y = atan(temp.z, temp.y / sinus);
    } else {
      resultat.y = atan(temp.z, temp.x / cos(resultat.x));
    }
  }
  return resultat;
}

#pragma glslify: export(project)
