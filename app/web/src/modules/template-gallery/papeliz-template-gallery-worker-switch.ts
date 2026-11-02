// Whether the app's Templates use the Templates Worker (papeliz.com/api/templates/*).
//
// While false, the gallery lists only the built-in static list (papeliz-template-gallery-static-list.json),
// and asks no Papeliz server anything:
// - Featured shows the static list, and Preview, Use Template and Import from Template read each
//   template from jsDelivr at its pinned commit, as always;
// - New, Top 100, Submit, votes, Report and Recheck stay in their places, greyed, marked Coming Soon;
// - Submit Template's Check still works, since it asks only GitHub and jsDelivr.
//
// Turning it on goes with the app's reads of the Worker: its hourly list, falling back to the static list
// when the Worker can't be reached, and Submit, votes, Report and Recheck through its routes.
export const isPapelizTemplateGalleryWorkerSwitchedOn = false
