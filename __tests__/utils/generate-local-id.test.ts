import { generateLocalId } from "@/utils/generate-local-id";

describe("generateLocalId", () => {
  it("returns a stable uuid from expo-crypto", () => {
    expect(generateLocalId()).toBe("test-uuid-0000-4000-8000-000000000001");
  });
});
