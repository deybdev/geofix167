export function setResponderMeta(title, description) {
  document.title = `${title} | GeoFix Responder`;
  let descriptionTag = document.querySelector('meta[name="description"]');

  if (!descriptionTag) {
    descriptionTag = document.createElement("meta");
    descriptionTag.name = "description";
    document.head.appendChild(descriptionTag);
  }

  descriptionTag.content = description;
}
