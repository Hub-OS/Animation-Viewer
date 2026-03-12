// Use `npm run licenses` to generate the json file
import projects from "../_licenses.json";

// interaction:
const dialogElement = document.getElementById(
  "about-dialog",
) as HTMLDialogElement;

const listElement = document.createElement("div");
listElement.className = "about-section-body";

for (const project of projects) {
  const listItem = document.createElement("div");
  listItem.className = "about-listing";

  // add name
  const nameElement = document.createElement("div");
  nameElement.innerText = project.name;
  listItem.appendChild(nameElement);

  // add links
  const linksElement = document.createElement("div");
  linksElement.className = "links";

  if (project.homepage) {
    const homepageLinkElement = document.createElement("a");
    homepageLinkElement.innerText = "Homepage";
    homepageLinkElement.href = project.homepage;
    homepageLinkElement.target = "_blank";
    linksElement.appendChild(homepageLinkElement);
  }

  const licenseText = project.licenses
    .map((license) => license.text)
    .join("\n\n" + "-".repeat(80) + "\n\n");

  const licenseLinkElement = document.createElement("a");
  licenseLinkElement.innerText = "License";
  licenseLinkElement.href = "javascript:void";
  licenseLinkElement.onclick = function () {
    const w = window.open("about:blank")!;

    w.document.body.innerText = licenseText;
  };
  linksElement.appendChild(licenseLinkElement);

  listItem.appendChild(linksElement);

  // add to list
  listElement.appendChild(listItem);
}

dialogElement.appendChild(listElement);
