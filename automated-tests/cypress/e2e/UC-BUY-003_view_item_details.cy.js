/// <reference types="cypress" />

describe("UC-BUY-003: View Item Details", () => {
  beforeEach(() => {
    cy.loginAsBuyer();
    cy.navigateToProducts();
  });

  it("T01 – Clicking a catalog card navigates to item detail page", () => {
    cy.get(".product-card").first().click();
    cy.url().should("include", "/item/");
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");
  });

  it("T02 – Detail page shows stone name, dimensions, stock badge, and info sections", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.get(".item-info-section h1").should("exist").invoke("text").should("not.be.empty");
    cy.get(".status-badge").should("exist").invoke("text").should("not.be.empty");
    cy.get(".dimensions").should("exist").invoke("text").should("not.be.empty");
    cy.get(".info-section").should("have.length.greaterThan", 2);
  });

  it("T03 – Product image is displayed with zoom hint", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.get(".item-image-wrapper img")
      .should("exist")
      .and("have.attr", "src")
      .and("not.be.empty");

    cy.get(".image-hint").should("contain", "zoom");
  });

  it("T04 – Image zoom opens and closes correctly", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.get(".item-image-wrapper").click();
    cy.get(".item-image-wrapper.zoomed").should("exist");
    cy.get(".zoom-controls").should("be.visible");
    cy.get(".zoom-controls span").should("contain", "100");

    cy.get(".zoom-controls button").first().click();
    cy.get(".zoom-controls span").should("contain", "125");

    cy.get(".item-image-wrapper.zoomed").click({ force: true });
    cy.get(".image-hint").should("be.visible");
  });

  it("T05 – Request Quote or Out of Stock button is present", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.get(".item-actions .primary-btn").should("exist").invoke("text").then((text) => {
      const trimmed = text.trim();
      expect(trimmed === "Request Quote" || trimmed === "Out of Stock").to.be.true;
    });
  });

  it("T06 – Back to Catalog button returns to /products", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.get(".back-btn").should("contain", "Back to Catalog");
    cy.get(".back-btn").click({ force: true });
    cy.url().should("include", "/products");
    cy.get(".products-page").should("be.visible");
  });

  it("T07 – Invalid item ID shows error state or redirects", () => {
    cy.get(".product-card").first().click();
    cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");

    cy.window().then((win) => {
      win.history.pushState({}, "", "/item/000000000000000000000000");
    });
    cy.reload();

    cy.wait(3000);
    cy.get("body").then(($body) => {
      const text = $body.text().toLowerCase();

      const hasError =
        text.includes("unable to load") ||
        text.includes("not found") ||
        text.includes("error") ||
        text.includes("invalid") ||
        text.includes("failed");

      cy.url().then((currentUrl) => {
        const redirectedAway = !currentUrl.includes("/item/000000000000000000000000");
        expect(hasError || redirectedAway).to.be.true;
      });
    });
  });
});
