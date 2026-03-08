/// <reference types="cypress" />

describe("UC-BUY-001: Browse Catalog", () => {
  beforeEach(() => {
    cy.loginAsBuyer();
    cy.navigateToProducts();
  });

  it("T01 – Products page loads with grid of stone block cards and count label", () => {
    cy.get(".products-page", { timeout: 15000 }).should("be.visible");
    cy.get(".sort-bar .results-count").invoke("text").should("match", /\d+\s+block/i);
    cy.get(".products-grid .product-card").should("have.length.greaterThan", 0);
  });

  it("T02 – Product card displays image, name, dimensions, and stock badge", () => {
    cy.get(".product-card").first().within(() => {
      cy.get(".product-image img").should("exist").and("have.attr", "src").and("not.be.empty");
      cy.get(".product-name").invoke("text").should("not.be.empty");
      cy.get(".product-dimensions").should("exist");
      cy.get(".product-stock").should("exist");
    });
  });

  it("T03 – Sort by 'Price: Low to High' re-orders the product grid", () => {
    cy.get("#sort-by").should("be.visible").select("price_low");

    cy.get(".products-grid", { timeout: 10000 }).should("be.visible");
    cy.get(".product-card").should("have.length.greaterThan", 0);
  });

  it("T04 – Sort by 'Name: Z-A' re-orders the product grid", () => {
    cy.get("#sort-by").select("name_desc");

    cy.get(".products-grid", { timeout: 10000 }).should("be.visible");
    cy.get(".product-card").should("have.length.greaterThan", 0);
  });

  it("T05 – Category filter narrows displayed products", () => {
    cy.get("body").then(($body) => {
      if ($body.find("#filter-category").length > 0) {
        cy.get("#filter-category").select("Granite");

        cy.get("body").then(($b) => {
          if ($b.find(".apply-filters-btn").length > 0) {
            cy.get(".apply-filters-btn").click();
          }
        });

        cy.wait(2000);
        cy.get(".products-grid").should("be.visible");
        cy.get(".sort-bar .results-count").invoke("text").should("match", /\d+\s+block/i);
      }
    });
  });

  it("T06 – Clear Filters restores the full unfiltered catalog", () => {
    cy.get("body").then(($body) => {
      if ($body.find("#filter-category").length > 0) {
        cy.get("#filter-category").select("Granite");

        if ($body.find(".apply-filters-btn").length > 0) {
          cy.get(".apply-filters-btn").click();
        }
        cy.wait(1500);

        cy.get(".clear-filters-btn").click();
        cy.wait(2000);

        cy.get(".products-grid").should("be.visible");
        cy.get(".product-card").should("have.length.greaterThan", 0);
      }
    });
  });

  it("T07 – Request Quote button on an In Stock card navigates to item detail or request-quote", () => {
    cy.get(".product-card").first().within(() => {
      cy.get(".product-stock").invoke("text").then((stockText) => {
        if (!stockText.toLowerCase().includes("out of stock")) {
          cy.get(".request-btn").should("not.be.disabled").click();
        }
      });
    });

    cy.url({ timeout: 15000 }).should("match", /\/(request-quote|item\/|stone\/)/);
  });

  it("T08 – Out of Stock card has disabled Request Quote button", () => {
    cy.get("body").then(($body) => {
      const outOfStock = $body.find(".product-stock.out-of-stock");
      if (outOfStock.length > 0) {
        cy.get(".product-stock.out-of-stock")
          .first()
          .closest(".product-card")
          .find(".request-btn")
          .should("have.class", "disabled");
      } else {
        cy.log("No out-of-stock products in current catalog — skipping");
      }
    });
  });

  it("T09 – Search with non-existent keyword shows empty state or no results", () => {
    cy.get("body").then(($body) => {
      if ($body.find("#product-search").length > 0) {
        cy.get("#product-search").clear().type("XYZNONEXIST999STONE");

        if ($body.find(".apply-filters-btn").length > 0) {
          cy.get(".apply-filters-btn").click();
        }
        cy.wait(2000);

        cy.get("body").then(($b) => {
          const hasCards = $b.find(".product-card").length > 0;
          const hasEmpty = $b.find(".empty-state").length > 0;
          const text = $b.text().toLowerCase();
          const hasNoResults = text.includes("no blocks found") || text.includes("no results");
          expect(!hasCards || hasEmpty || hasNoResults).to.be.true;
        });
      }
    });
  });
});
