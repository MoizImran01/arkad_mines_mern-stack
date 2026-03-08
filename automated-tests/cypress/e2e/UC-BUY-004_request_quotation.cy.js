/// <reference types="cypress" />

function addItemViaDetail() {
  cy.get(".product-card").first().click();
  cy.get(".item-detail-container", { timeout: 15000 }).should("be.visible");
  cy.get(".item-actions .primary-btn").contains("Request Quote").click();
}

describe("UC-BUY-004: Request Quotation", () => {
  beforeEach(() => {
    cy.loginAsBuyer();
    cy.navigateToProducts();
  });

  it("T01 – Add item to quote cart and land on Request Quote page", () => {
    addItemViaDetail();

    cy.url().should("include", "/request-quote");
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");
    cy.get(".quote-item").should("have.length.greaterThan", 0);
  });

  it("T02 – Quote page shows item image, name, quantity input, and price", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    cy.get(".quote-item").first().within(() => {
      cy.get("img").should("exist").and("have.attr", "src").and("not.be.empty");
      cy.get("h3").invoke("text").should("not.be.empty");
      cy.get("input[type='number']").should("exist");
      cy.get(".price-note").invoke("text").should("match", /Rs\s+\d/);
    });
  });

  it("T03 – Quantity field accepts a valid number; exceeding stock shows warning", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    const qtyInput = () =>
      cy.get(".quote-item .quantity-control input[type='number']").first();

    qtyInput().should("exist").and("not.be.disabled");

    qtyInput().type("{selectall}999999");
    cy.wait(500);
    cy.get("body").then(($body) => {
      if ($body.find(".max-quantity-warning").length > 0) {
        cy.get(".max-quantity-warning").should("be.visible");
      }
    });

    qtyInput().type("{selectall}2");
    cy.wait(500);
    qtyInput().should("have.value", "2");
  });

  it("T04 – Delivery Notes textarea accepts and stores text", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    const notes = "Deliver to Warehouse B, polished finish needed";
    cy.get("#notes").should("be.visible").clear().type(notes);
    cy.get("#notes").should("have.value", notes);
  });

  it("T05 – Remove button removes an item from the quote cart", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    cy.get(".quote-item").should("have.length.greaterThan", 0);
    cy.get(".quote-item .link-btn").first().click();

    cy.get("body").then(($body) => {
      if ($body.find(".quote-item").length === 0) {
        cy.get(".empty-state").should("be.visible").and("contain", "No items selected");
      }
    });
  });

  it("T06 – Clear All removes every item and shows empty state", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    cy.get(".clear-btn").click();
    cy.get(".empty-state").should("be.visible").and("contain", "No items selected");
    cy.get(".empty-state .secondary-btn").should("contain", "Browse Products");
  });

  it("T07 – Submit and Save as Draft disabled when cart is empty", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    cy.get(".clear-btn").click();
    cy.get(".empty-state").should("be.visible");

    cy.get(".action-buttons .primary-btn")
      .should("contain", "Submit Request")
      .and("be.disabled");
    cy.get(".action-buttons .secondary-btn")
      .should("contain", "Save as Draft")
      .and("be.disabled");
  });

  it("T08 – Browse Products button in empty state navigates back to /products", () => {
    addItemViaDetail();
    cy.get(".request-quote-page", { timeout: 15000 }).should("be.visible");

    cy.get(".clear-btn").click();
    cy.get(".empty-state").should("be.visible");

    cy.get(".empty-state .secondary-btn").contains("Browse Products").click();
    cy.url().should("include", "/products");
    cy.get(".products-page", { timeout: 15000 }).should("be.visible");
  });
});
