import {
  MAX_INVITES,
  validateInput,
} from "@/utils/validateInput";

describe("validateInput", () => {
  describe("url", () => {
    it.each(["javascript:alert(1)", "ftp://example.com", "example.com"])(
      "should reject the link %s",
      (value) => {
        expect(validateInput.url(value)).toBe(false);
      },
    );

    it("should accept http and https links up to 2048 characters", () => {
      expect(validateInput.url("http://example.com")).toBe(true);
      expect(validateInput.url(" https://example.com/reserva ")).toBe(true);
      expect(
        validateInput.url(`https://example.com/${"a".repeat(2028)}`),
      ).toBe(true);
    });

    it("should reject links longer than 2048 characters", () => {
      expect(
        validateInput.url(`https://example.com/${"a".repeat(2029)}`),
      ).toBe(false);
    });
  });

  describe("email", () => {
    it("should normalize e-mails with trim and lower case", () => {
      expect(validateInput.normalizeEmail("  Ana.Silva@Example.COM ")).toBe(
        "ana.silva@example.com",
      );
    });

    it("should validate the normalized e-mail", () => {
      expect(validateInput.email("  Ana@Example.com ")).toBe(true);
      expect(validateInput.email("ana@")).toBe(false);
    });

    it("should reject e-mails longer than 254 characters", () => {
      expect(validateInput.email(`${"a".repeat(64)}@${"b".repeat(186)}.com`)).toBe(
        false,
      );
    });
  });

  describe("destination", () => {
    it("should accept destinations from 3 to 100 trimmed characters", () => {
      expect(validateInput.destination("  Rio  ")).toBe(true);
      expect(validateInput.destination("a".repeat(100))).toBe(true);
    });

    it("should reject destinations shorter than 3 or longer than 100 characters", () => {
      expect(validateInput.destination("  Ri  ")).toBe(false);
      expect(validateInput.destination("a".repeat(101))).toBe(false);
    });
  });

  describe("itemTitle", () => {
    it("should accept item titles from 1 to 100 trimmed characters", () => {
      expect(validateInput.itemTitle(" M ")).toBe(true);
      expect(validateInput.itemTitle("a".repeat(100))).toBe(true);
    });

    it("should reject blank or longer than 100 item titles", () => {
      expect(validateInput.itemTitle("   ")).toBe(false);
      expect(validateInput.itemTitle("a".repeat(101))).toBe(false);
    });
  });

  describe("personName", () => {
    it("should accept names from 3 to 100 trimmed characters", () => {
      expect(validateInput.personName(" Ana ")).toBe(true);
      expect(validateInput.personName("An")).toBe(false);
      expect(validateInput.personName("a".repeat(101))).toBe(false);
    });
  });

  describe("password", () => {
    it("should reject passwords shorter than 8 characters", () => {
      expect(validateInput.password("1234567")).toBe(false);
      expect(validateInput.password("12345678")).toBe(true);
    });

    it("should reject passwords longer than 72 bytes even when under 72 characters", () => {
      expect(validateInput.password("é".repeat(36))).toBe(true);
      expect(validateInput.password("é".repeat(37))).toBe(false);
    });
  });

  describe("phone", () => {
    it("should accept phones with at least 10 digits and allowed symbols", () => {
      expect(validateInput.phone("+55 (67) 99999-9999")).toBe(true);
      expect(validateInput.phone("6799999999")).toBe(true);
    });

    it.each(["123456789", "(67) abcd-1234", "+55 (67) 99999-99999-9999"])(
      "should reject the phone %s",
      (value) => {
        expect(validateInput.phone(value)).toBe(false);
      },
    );
  });

  it("should allow up to 20 invites", () => {
    expect(MAX_INVITES).toBe(20);
  });
});
