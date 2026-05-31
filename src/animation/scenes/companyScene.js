/**
 * COMPANY SCENE ANIMATIONS
 *
 * In this adapted story, the "company" moment maps to the boredom/explosion beat —
 * the point where SWE and quant stopped being interesting.
 * Company logos have been removed as they were specific to the original author.
 */

/**
 * Company logos hidden — not relevant to this story
 */
export const createCompanyLogoAnimations = (
  SCENE_TIMING,
  drawStrokesAndHide
) => {
  return []; // logos removed
};


/**
 * Creates company environment animations
 */
export const createCompanyEnvironmentAnimations = (
  SCENE_TIMING,
  display,
  appearAt
) => {
  const {
    company: [companyStart, companyEnd],
  } = SCENE_TIMING;

  return [
    // Company environment
    ["company", display(companyStart - 50, 50, companyEnd)],
    ["companywalls", display(companyStart + 20, 30, companyEnd - 80, 30)],
    ["companyshadows", display(companyStart + 60, 30, companyEnd - 50, 20)],
    ["companydesk", appearAt(companyStart + 10, 10)],
    ["companyinterior", display(companyStart + 30, 40, companyEnd - 50, 20)],
  ];
};
