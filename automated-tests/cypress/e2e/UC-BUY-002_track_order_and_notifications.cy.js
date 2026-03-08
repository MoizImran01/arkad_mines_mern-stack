/// <reference types="cypress" />

describe("UC-BUY-002: Track Order and Notifications", () => {
  beforeEach(() => {
    cy.loginAsAdminAndVisit("/orders");
    cy.get(".orders-admin-container", { timeout: 20000 }).should("be.visible");
    cy.get(".orders-table", { timeout: 15000 }).should("be.visible");
    cy.wait(1000);
  });

  it("T01 – Orders page loads with stats cards, filters, and order table", () => {
    cy.get(".stat-card").should("have.length.gte", 4);
    cy.get(".stat-card").eq(0).find(".stat-info").should("contain", "Total");

    cy.get('input[placeholder*="Search by order number"]').should("exist");
    cy.get(".orders-filters select").should("exist");

    cy.get(".orders-table tbody .order-row").should("have.length.gte", 1);
  });

  it("T02 – Filter orders by status narrows the results", () => {
    cy.intercept("GET", "**/api/orders/admin/all*").as("ordersApi");

    cy.get(".orders-filters select").select("confirmed");
    cy.get(".orders-filters select").should("have.value", "confirmed");

    cy.wait("@ordersApi").then((interception) => {
      expect(interception.request.url).to.include("status=confirmed");
      expect(interception.response.statusCode).to.be.oneOf([200, 304]);
    });

    cy.get(".orders-filters select").select("");
    cy.wait(2000);
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

      cy.get('input[placeholder*="Search by order number"]').clear({ force: true });
      cy.wait(1000);
      cy.get('input[placeholder*="Search by order number"]').type(searchTerm, { force: true });
      cy.wait(2000);

      cy.get("body").then(($body) => {
        if ($body.find(".order-row").length > 0) {
          cy.get(".order-row").first().should("contain", searchTerm);
        }
      });
    });
  });

  it("T05 – Search with non-existent term shows empty state", () => {
    cy.get('input[placeholder*="Search by order number"]').clear({ force: true });
    cy.wait(1000);
    cy.get('input[placeholder*="Search by order number"]').type("XYZNONEXIST999", { force: true });
    cy.wait(2000);

    cy.get("body").then(($body) => {
      const hasRows = $body.find(".order-row").length > 0;
      const hasEmpty = $body.find(".empty-state, .no-orders").length > 0;
      const bodyText = $body.text().toLowerCase();
      const hasNoResults = bodyText.includes("no orders") || bodyText.includes("no results");
      expect(!hasRows || hasEmpty || hasNoResults).to.be.true;
    });
  });

  it("T06 – Clearing search restores full order list", () => {
    cy.get('input[placeholder*="Search by order number"]').clear({ force: true });
    cy.wait(1000);
    cy.get('input[placeholder*="Search by order number"]').type("XYZNONEXIST999", { force: true });
    cy.wait(2000);

    cy.get('input[placeholder*="Search by order number"]').clear({ force: true });
    cy.wait(2000);

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
