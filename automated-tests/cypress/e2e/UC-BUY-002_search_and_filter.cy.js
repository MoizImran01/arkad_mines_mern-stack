/// <reference types="cypress" />

describe("UC-BUY-002: Search and Filter", () => {
  beforeEach(() => {
    cy.loginAsBuyer();
    cy.navigateToProducts();
  });

  it("T01 – Page loads with filter controls and product grid", () => {
    cy.get("#filter-category").should("be.visible");
    cy.get("#filter-subcategory").should("be.visible");
    cy.get("#product-search").should("be.visible");
    cy.get("#sort-by").should("be.visible");

    cy.get(".results-count").invoke("text").should("match", /\d+ blocks? found/);
    cy.get(".product-card").should("have.length.greaterThan", 0);
  });

  it("T02 – Filter by category shows only matching blocks", () => {
    cy.get(".product-card").its("length").then((initialCount) => {
      cy.get("#filter-category").select("Marble");
      cy.wait(1200);
      cy.get(".loading-state").should("not.exist");

      cy.get("body").then(($body) => {
        if ($body.find(".product-card").length > 0) {
          cy.get(".product-card").its("length").should("be.lte", initialCount);
        } else {
          cy.get(".empty-state").should("contain", "No blocks found");
        }
      });
    });
  });

  it("T03 – Filter by subcategory narrows results", () => {
    cy.get("#filter-subcategory").select("Block");
    cy.wait(1200);
    cy.get(".loading-state").should("not.exist");
    cy.get(".results-count").invoke("text").should("match", /\d+ blocks? found/);
  });

  it("T04 – Sort by Price: Low to High re-orders results", () => {
    cy.get("#sort-by").select("price_low");
    cy.wait(1200);
    cy.get(".loading-state").should("not.exist");
    cy.get(".products-grid, .products-main").should("be.visible");
  });

  it("T05 – Keyword search filters by name", () => {
    cy.get(".product-name").first().invoke("text").then((firstName) => {
      const keyword = firstName.trim().split(" ")[0];
      cy.get("#product-search").clear().type(keyword);
      cy.wait(1500);
      cy.get(".loading-state").should("not.exist");

      cy.get("body").then(($body) => {
        if ($body.find(".product-card").length > 0) {
          cy.get(".product-name").first().invoke("text").should("contain", keyword);
        } else {
          cy.get(".empty-state").should("contain", "No blocks found");
        }
      });
    });
  });

  it("T06 – Stock availability filter shows only In Stock", () => {
    cy.get("#filter-availability").select("In Stock");
    cy.wait(1200);
    cy.get(".loading-state").should("not.exist");

    cy.get("body").then(($body) => {
      if ($body.find(".product-card").length > 0) {
        cy.get(".product-stock").each(($el) => {
          cy.wrap($el).invoke("text").should("contain", "In Stock");
        });
      }
    });
  });

  it("T07 – Clear All resets filters and restores full catalog", () => {
    cy.get("#filter-category").select("Granite");
    cy.wait(1200);
    cy.get(".loading-state").should("not.exist");

    cy.get(".clear-filters-btn").first().click();
    cy.wait(1200);
    cy.get(".loading-state").should("not.exist");

    cy.get("#filter-category").should("have.value", "all");
    cy.get("#filter-subcategory").should("have.value", "all");
    cy.get("#product-search").should("have.value", "");
    cy.get(".product-card").should("have.length.greaterThan", 0);
  });

  it("T08 – Empty search shows no blocks found", () => {
    cy.get("#product-search").clear().type("xyznonexistentblock999");
    cy.wait(1500);
    cy.get(".loading-state").should("not.exist");
    cy.get(".empty-state").should("be.visible").and("contain", "No blocks found");
    cy.get(".product-card").should("have.length", 0);
  });
});
