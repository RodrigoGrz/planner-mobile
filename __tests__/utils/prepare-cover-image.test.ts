import { ImageManipulator } from "expo-image-manipulator";

import { prepareCoverImage } from "@/utils/prepare-cover-image";

const mockImageRef = { saveAsync: jest.fn(), release: jest.fn() };
const mockContext = {
  resize: jest.fn(),
  renderAsync: jest.fn(),
  release: jest.fn(),
};

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn(() => mockContext) },
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}));

describe("prepareCoverImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.resize.mockReturnValue(mockContext);
    mockContext.renderAsync.mockResolvedValue(mockImageRef);
    mockImageRef.saveAsync.mockResolvedValue({
      uri: "file:///cache/converted.jpg",
      width: 1920,
      height: 1080,
    });
  });

  it("should save the cover as a compressed JPEG", async () => {
    await prepareCoverImage({ uri: "file:///cache/photo.heic", width: 1000, height: 800 });

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith(
      "file:///cache/photo.heic",
    );
    expect(mockImageRef.saveAsync).toHaveBeenCalledWith({
      format: "jpeg",
      compress: 0.8,
    });
  });

  it("should resize a landscape image by its width", async () => {
    await prepareCoverImage({ uri: "file:///cache/photo.heic", width: 4032, height: 3024 });

    expect(mockContext.resize).toHaveBeenCalledWith({ width: 1920 });
  });

  it("should resize a portrait image by its height", async () => {
    await prepareCoverImage({ uri: "file:///cache/photo.heic", width: 3024, height: 4032 });

    expect(mockContext.resize).toHaveBeenCalledWith({ height: 1920 });
  });

  it("should not upscale an image smaller than the limit", async () => {
    await prepareCoverImage({ uri: "file:///cache/photo.png", width: 800, height: 600 });

    expect(mockContext.resize).not.toHaveBeenCalled();
    expect(mockContext.renderAsync).toHaveBeenCalledTimes(1);
  });

  it("should release the native image objects after saving", async () => {
    await prepareCoverImage({ uri: "file:///cache/photo.heic", width: 4032, height: 3024 });

    expect(mockImageRef.release).toHaveBeenCalledTimes(1);
    expect(mockContext.release).toHaveBeenCalledTimes(1);
  });

  it("should release the native image objects when saving fails", async () => {
    mockImageRef.saveAsync.mockRejectedValueOnce(new Error("disk full"));

    await expect(
      prepareCoverImage({ uri: "file:///cache/photo.heic", width: 4032, height: 3024 }),
    ).rejects.toThrow("disk full");

    expect(mockImageRef.release).toHaveBeenCalledTimes(1);
    expect(mockContext.release).toHaveBeenCalledTimes(1);
  });

  it("should release the context when rendering fails", async () => {
    mockContext.renderAsync.mockRejectedValueOnce(new Error("decode failed"));

    await expect(
      prepareCoverImage({ uri: "file:///cache/photo.heic", width: 4032, height: 3024 }),
    ).rejects.toThrow("decode failed");

    expect(mockContext.release).toHaveBeenCalledTimes(1);
  });

  it("should return the uri of the converted image", async () => {
    const uri = await prepareCoverImage({
      uri: "file:///cache/photo.webp",
      width: 2000,
      height: 1000,
    });

    expect(uri).toBe("file:///cache/converted.jpg");
  });
});
