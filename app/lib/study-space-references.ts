// Official university pages confirm study facilities at these existing OSM objects.
// Coordinates remain the OSM node/area center, not a surveyed room or entrance.
export const studySpaceReferences: Record<string, {cityId:string;url:string;category?:"library"}> = {
  "way/681098586": {cityId:"london",url:"https://www.ucl.ac.uk/library/using-library/libraries-and-study-spaces/student-centre"},
  "way/16784706": {cityId:"sydney",url:"https://www.sydney.edu.au/students/study-spaces.html",category:"library"},
  "way/54583490": {cityId:"singapore",url:"https://www.nus.edu.sg/nuslibraries/spaces/our-libraries/central-library"},
  "way/995983168": {cityId:"kuala-lumpur",url:"https://umlib.um.edu.my/study-spaces"},
  "way/898471121": {cityId:"hong-kong",url:"https://lib.hku.hk/mainlib/studyplace.html"},
};
