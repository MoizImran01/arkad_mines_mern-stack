/// <reference types="cypress" />

describe("UC-BUY-003: Register and Dispatch Granite Block", () => {
  beforeEach(() => {
    cy.loginAsAdminAndVisit("/add");
    cy.get(".add-product", { timeout: 20000 }).should("be.visible");
  });

  it("T01 – Add Stone form displays all required fields", () => {
    cy.get('select[name="stoneName"]').should("be.visible");
    cy.get('#image').should("exist");
    cy.get('input[name="dimensions"]').should("be.visible");
    cy.get('select[name="category"]').should("be.visible");
    cy.get('select[name="subcategory"]').should("be.visible");
    cy.get('input[name="price"]').should("be.visible");
    cy.get('select[name="priceUnit"]').should("be.visible");
    cy.get('select[name="stockAvailability"]').should("be.visible");
    cy.get('input[name="stockQuantity"]').should("be.visible");
    cy.get('input[name="location"]').should("be.visible");
    cy.get('textarea[name="notes"]').should("be.visible");
    cy.contains("Register Block").should("exist");
  });

  it("T02 – Stone Name dropdown contains all 9 stone options", () => {
    const stones = [
      "Cheeta White", "Chitral White", "Diamond Blue", "Imperial White",
      "Jebrana", "Pradeso", "Sado Gray", "Sado Pink", "Tiger Gray"
    ];
    stones.forEach((stone) => {
      cy.get('select[name="stoneName"]').find(`option`).then(($opts) => {
        const optTexts = [...$opts].map((o) => o.textContent.trim());
        expect(optTexts).to.include(stone);
      });
    });
  });

  it("T03 – Category dropdown has Marble and Granite options", () => {
    cy.get('select[name="category"]').find('option[value="Marble"]').should("exist");
    cy.get('select[name="category"]').find('option[value="Granite"]').should("exist");
  });

  it("T04 – Form fields accept valid mid-range input", () => {
    cy.get('select[name="stoneName"]').select("Chitral White");
    cy.get('input[name="dimensions"]').clear().type("3000x2000x20mm");
    cy.get('select[name="category"]').select("Marble");
    cy.get('select[name="subcategory"]').select("Block");
    cy.get('input[name="price"]').clear().type("150");
    cy.get('select[name="stockAvailability"]').select("In Stock");
    cy.get('input[name="stockQuantity"]').clear().type("100");
    cy.get('input[name="location"]').clear().type("Warehouse A, Section B");
    cy.get('textarea[name="notes"]').clear().type("Test registration block");

    cy.get('select[name="stoneName"]').should("have.value", "Chitral White");
    cy.get('input[name="dimensions"]').should("have.value", "3000x2000x20mm");
    cy.get('input[name="price"]').should("have.value", "150");
    cy.get('input[name="stockQuantity"]').should("have.value", "100");
  });

  it("T05 – BVA: Price=0 and Quantity=1 accepted by form inputs", () => {
    cy.get('select[name="stoneName"]').select("Imperial White");
    cy.get('input[name="dimensions"]').clear().type("1500x1000x10mm");
    cy.get('select[name="category"]').select("Marble");
    cy.get('select[name="subcategory"]').select("Slab");
    cy.get('input[name="price"]').clear().type("0");
    cy.get('input[name="stockQuantity"]').clear().type("1");

    cy.get('input[name="price"]').should("have.value", "0");
    cy.get('input[name="stockQuantity"]').should("have.value", "1");
  });

  it("T06 – BVA: Large price and quantity values accepted", () => {
    cy.get('select[name="stoneName"]').select("Tiger Gray");
    cy.get('input[name="dimensions"]').clear().type("8000x4000x100mm");
    cy.get('select[name="category"]').select("Granite");
    cy.get('select[name="subcategory"]').select("Block");
    cy.get('input[name="price"]').clear().type("999999");
    cy.get('select[name="stockAvailability"]').select("Out of Stock");
    cy.get('input[name="stockQuantity"]').clear().type("99999");

    cy.get('input[name="price"]').should("have.value", "999999");
    cy.get('input[name="stockQuantity"]').should("have.value", "99999");
  });

  it("T07 – ECP: Granite category with Crushed Stone product type", () => {
    cy.get('select[name="stoneName"]').select("Diamond Blue");
    cy.get('input[name="dimensions"]').clear().type("5000x3000x50mm");
    cy.get('select[name="category"]').select("Granite");
    cy.get('select[name="subcategory"]').select("Crushed Stone");
    cy.get('input[name="price"]').clear().type("5000");
    cy.get('select[name="stockAvailability"]').select("Low Stock");
    cy.get('input[name="stockQuantity"]').clear().type("50");

    cy.get('select[name="category"]').should("have.value", "Granite");
    cy.get('select[name="subcategory"]').should("have.value", "Crushed Stone");
    cy.get('select[name="stockAvailability"]').should("have.value", "Low Stock");
  });

  it("T08 – Stock availability dropdown has all 4 options", () => {
    const statuses = ["In Stock", "Low Stock", "Out of Stock", "Pre-order"];
    statuses.forEach((status) => {
      cy.get('select[name="stockAvailability"]').find("option").then(($opts) => {
        const texts = [...$opts].map((o) => o.textContent.trim());
        expect(texts).to.include(status);
      });
    });
  });
});
