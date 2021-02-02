#define ECKERT_CONST 2.26750802723822639138
#define ECKERT_ITERATION 40
#define PI 3.1415926535897932384626433832795

const float exckert_delta_const = 2.57079632679489661923;

float deltaEckert(in float theta, in float phi) {
  return -(theta + sin(theta) - exckert_delta_const * sin(phi)) /
         (1.0 + cos(theta));
}

vec3 eckert(in vec3 pos, in float threeRadius, in float earthRadius,
            in vec3 reference) {
  vec3 resultat = vec3(0.0);
  float theta = reference.y;
  for (int i = 0; i < ECKERT_ITERATION; i++) {
    theta += deltaEckert(theta, pos.y);
  }
  resultat.x =
      (pos.x - reference.x) * (1.0 + cos(theta)) / ECKERT_CONST * threeRadius;
  resultat.y = 2.0 * theta / ECKERT_CONST * threeRadius;
  resultat.z = (pos.z - reference.z) / earthRadius * threeRadius;
  return resultat;
}

vec3 vanDerGrinten(in vec3 pos, in float threeRadius, in float earthRadius,
                   in vec3 reference) {
  vec3 resultat = vec3(0.0);
  resultat.z = (pos.z - reference.z) / earthRadius * threeRadius;
  float theta = asin(abs(2.0 * pos.y / PI));
  if (abs(pos.x - reference.x) < 0.000001 || abs(theta - PI / 2.0) < 0.000001) {
    resultat.y = sign(pos.y) * PI * threeRadius * tan(theta / 2.0);
  } else if (abs(pos.y) < 0.000001) {
    resultat.x = (pos.x - reference.x) * threeRadius;
  } else {
    float A = .5 * abs(PI / (pos.x - reference.x) - (pos.x - reference.x) / PI);
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    float G = cosTheta / (sinTheta + cosTheta - 1.0);
    float P = G * (2.0 / sinTheta - 1.0);
    float Q = A * A + G;
    float A_A = A * A;
    float P_P = P * P;
    float denominateur = P_P + A_A;
    resultat.x = sign(pos.x - reference.x) * PI * threeRadius / denominateur *
                 (A * (G - P_P) +
                  sqrt(pow(A * (G - P_P), 2.0) - (P_P + A_A) * (G * G - P_P)));
    resultat.y = sign(pos.y) * PI * threeRadius / denominateur *
                 abs(P * Q - A * sqrt((A_A + 1.0) * denominateur - Q * Q));
  }
  return resultat;
}

vec3 conicEquidistant(in vec3 pos, in float threeRadius, in float earthRadius,
                      in vec3 reference, in float standardParallel1,
                      in float standardParallel2) {
  vec3 resultat = vec3(0.0);
  float n = (cos(standardParallel1) - cos(standardParallel2)) /
            (standardParallel2 - standardParallel1);
  float G = cos(standardParallel1) / n + standardParallel1;
  float rho0 = G - reference.y;
  float theta = n * (pos.x - reference.x);
  float rho = G - pos.y;
  resultat.x = rho * sin(theta) * threeRadius;
  resultat.y = (rho0 - rho * cos(theta)) * threeRadius;
  resultat.z = (pos.z - reference.z) / earthRadius * threeRadius;
  return resultat;
}

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

vec3 winkel(in vec3 pos, in float threeRadius, in float earthRadius,
            in vec3 reference) {
  vec3 resultat = vec3(0.0);
  float cosPhi = cos(pos.y);
  float sinPhi = sin(pos.y);
  float alpha = acos(cosPhi * cos(pos.x / 2.0));
  float cardinalAlpha;
  if (abs(alpha) < .0000001) {
    cardinalAlpha = 1.0;
  } else {
    cardinalAlpha = sin(alpha) / alpha;
  }
  resultat.x = ((pos.x - reference.x) * cos(reference.y) +
                2.0 * cosPhi * sin(pos.x / 2.0) / cardinalAlpha) *
               threeRadius / 2.0;
  resultat.y =
      ((pos.y - reference.y) + sinPhi / cardinalAlpha) * threeRadius / 2.0;
  resultat.z = (pos.z - reference.z) / earthRadius * threeRadius;
  return resultat;
}

vec3 convertor(in vec3 pos, in float threeRadius, in float earthRadius,
               in vec3 reference, in float standardParallel1,
               in float standardParallel2, int representation) {
  vec3 resultat;
  if (representation == 0) {
    resultat = noRepresentation(pos, threeRadius, earthRadius);
  } else if (representation == 1) {
    resultat = equirectangular(pos, threeRadius, earthRadius, reference);
  } else if (representation == 2) {
    resultat = mercator(pos, threeRadius, earthRadius, reference.x);
  } else if (representation == 3) {
    resultat = winkel(pos, threeRadius, earthRadius, reference);
  } else if (representation == 4) {
    resultat = eckert(pos, threeRadius, earthRadius, reference);
  } else if (representation == 5) {
    resultat = vanDerGrinten(pos, threeRadius, earthRadius, reference);
  } else if (representation == 6) {
    resultat = conicEquidistant(pos, threeRadius, earthRadius, reference,
                                standardParallel1, standardParallel2);
  }
  return resultat;
}

vec3 transit(in vec3 pos, in float threeRadius, in float earthRadius,
             in vec3 reference, in float standardParallel1,
             in float standardParallel2, in int representationInit,
             in int representationEnd, in float percent) {
  vec3 resultat;
  if (representationInit == representationEnd) {
    resultat =
        convertor(pos, threeRadius, earthRadius, reference, standardParallel1,
                  standardParallel2, representationInit);
  } else {
    vec3 initVec =
        convertor(pos, threeRadius, earthRadius, reference, standardParallel1,
                  standardParallel2, representationInit);
    vec3 endVec =
        convertor(pos, threeRadius, earthRadius, reference, standardParallel1,
                  standardParallel2, representationEnd);
    resultat = mix(initVec, endVec, percent / 100.0);
  }
  return resultat;
}

#pragma glslify: export(transit)
