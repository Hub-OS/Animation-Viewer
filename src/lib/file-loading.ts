export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // load file as data url, then load as image
    const reader = new FileReader();

    reader.onload = function () {
      // load image
      const image = new Image();

      image.src = reader.result as string;

      image.onload = function () {
        resolve(image);
      };

      image.onerror = function () {
        reject(new Error(`Failed to load "${file.name}"`));
      };
    };

    reader.onerror = function () {
      reject(new Error(`Failed to load "${file.name}: ${reader.error}"`));
    };

    reader.readAsDataURL(file);
  });
}

export function loadTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function () {
      resolve(reader.result as string);
    };

    reader.onerror = function () {
      reject(new Error(`Failed to load "${file.name}: ${reader.error}"`));
    };

    reader.readAsText(file);
  });
}
