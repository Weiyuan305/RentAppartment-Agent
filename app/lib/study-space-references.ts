// Official university pages confirm study facilities at these existing OSM objects.
// Coordinates remain the OSM node/area center, not a surveyed room or entrance.
export const studySpaceReferences: Record<string, {cityId:string;url:string;category?:"library"}> = {
  "way/216684105": {cityId:"manchester",url:"https://www.library.manchester.ac.uk/locations-and-opening-hours/learning-commons/index.htm",category:"library"},
  "way/4308724": {cityId:"edinburgh",url:"https://library.ed.ac.uk/using-library/lib-locate/main-lib"},
  "way/42733274": {cityId:"liverpool",url:"https://www.liverpool.ac.uk/library/"},
  "way/447829915": {cityId:"birmingham",url:"https://www.birmingham.ac.uk/libraries/our-libraries/main-library",category:"library"},
  "way/22871257": {cityId:"melbourne",url:"https://library.unimelb.edu.au/library-locations-and-opening-hours"},
  "way/5001918": {cityId:"canberra",url:"https://anulib.anu.edu.au/news-events/news/bookable-spaces-chifley-library"},
  "way/681098586": {cityId:"london",url:"https://www.ucl.ac.uk/library/using-library/libraries-and-study-spaces/student-centre"},
  "way/16784706": {cityId:"sydney",url:"https://www.sydney.edu.au/students/study-spaces.html",category:"library"},
  "way/54583490": {cityId:"singapore",url:"https://www.nus.edu.sg/nuslibraries/spaces/our-libraries/central-library"},
  "way/995983168": {cityId:"kuala-lumpur",url:"https://umlib.um.edu.my/study-spaces"},
  "way/898471121": {cityId:"hong-kong",url:"https://lib.hku.hk/mainlib/studyplace.html"},
};
