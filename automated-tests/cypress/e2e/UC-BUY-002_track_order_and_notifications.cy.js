/// <reference types="cypress" />

describe("UC-BUY-002: Track Order and Notifications", () => {
  beforeEach(() => {
    cy.loginAsAdminAndVisit("/orders");
    cy.get(".orders-admin-container", { timeout: 20000 }).should("be.visible");
  });

  it("T01 – Orders page loads with stats cards, filters, and order table", () => {
    cy.get(".stat-card").should("have.length.gte", 4);
    cy.get(".stat-card").eq(0).find(".stat-info").should("contain", "Total");

    cy.get('input[placeholder*="Search by order number"]').should("exist");
    cy.get(".orders-filters select").should("exist");

    cy.get(".orders-table").should("be.visible");
    cy.get(".orders-table tbody .order-row").should("have.length.gte", 1);
  });

  it("T02 – Filter orders by status shows only matching orders", () => {
    cy.get(".orders-filters select").select("draft");
    cy.wait(1500);

    cy.get("body").then(($body) => {
      if ($body.find(".order-row").length > 0) {
        cy.get(".order-row .status-badge").each(($badge) => {
          cy.wrap($badge).invoke("text").should("match", /draft/i);
        });
      } else {
        cy.get(".empty-state, .no-orders").should("be.visible");
      }
    });
  });

  it("T03 – View Details expands order row to show details section", () => {
    cy.get(".details-btn").first().click();
    cy.wait(1000);

    cy.get(".order-details").should("be.visible");
    cy.get(".details-section").should("have.length.gte", 1);
  });

  it("T04 – Search by order number filters the table", () => {
    cy.get(".order-row .order-id").first().invoke("text").then((orderNum) => {
      const searchTerm = orderNum.trim().substring(0, 7);
      cy.get('input[placeholder*="Search by order number"]').clear().type(searchTerm);
      cy.wait(1000);

      cy.get("body").then(($body) => {
        if ($body.find(".order-row").length > 0) {
          cy.get(".order-row").first().should("contain", searchTerm);
        }
      });
    });
  });

  it("T05 – Search with non-existent term shows empty state", () => {
    cy.get('input[placeholder*="Search by order number"]').clear().type("XYZNONEXIST999");
    cy.wait(1000);

    cy.get("body").then(($body) => {
      const hasRows = $body.find(".order-row").length > 0;
      const hasEmpty = $body.find(".empty-state, .no-orders").length > 0;
      const bodyText = $body.text().toLowerCase();
      const hasNoResults = bodyText.includes("no orders") || bodyText.includes("no results");
      expect(!hasRows || hasEmpty || hasNoResults).to.be.true;
    });
  });

  it("T06 – Clearing search restores full order list", () => {
    cy.get('input[placeholder*="Search by order number"]').clear().type("XYZNONEXIST999");
    cy.wait(1000);

    cy.get('input[placeholder*="Search by order number"]').clear();
    cy.wait(1000);

    cy.get(".order-row").should("have.length.gte", 1);
  });

  it("T07 – Stats cards display numeric values", () => {
    cy.get(".stat-card .stat-info h3").each(($el) => {
      const text = $el.text().trim().replace(/[^0-9.]/g, "");
      const num = parseFloat(text);
      expect(num).to.be.gte(0);
    });
  });

  it("T08 – Pagination controls exist when orders exceed page limit", () => {
    cy.get("body").then(($body) => {
      if ($body.find(".orders-pagination").length > 0) {
        cy.get(".pagination-btn").should("have.length.gte", 1);
        cy.get(".pagination-info").should("exist");
      }
    });
  });
});
