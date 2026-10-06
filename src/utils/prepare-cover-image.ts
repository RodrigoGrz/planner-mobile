import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const COVER_IMAGE_MAX_SIDE = 1920;
export const COVER_IMAGE_COMPRESS = 0.8;

type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

export async function prepareCoverImage({
  uri,
  width,
  height,
}: PickedImage): Promise<string> {
  const context = ImageManipulator.manipulate(uri);

  try {
    if (Math.max(width, height) > COVER_IMAGE_MAX_SIDE) {
      context.resize(
        width >= height
          ? { width: COVER_IMAGE_MAX_SIDE }
          : { height: COVER_IMAGE_MAX_SIDE },
      );
    }

    const image = await context.renderAsync();

    try {
      const result = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: COVER_IMAGE_COMPRESS,
      });

      return result.uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
