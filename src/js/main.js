(() => {
const API_BASE_URL = "https://nutriplan-api.vercel.app/api/";
async function request(path, query = {}) {
  const url = new URL(path, API_BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The API returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `The API request failed (${response.status}).`,
    );
  }
  if (payload?.message && payload.message !== "success") {
    throw new Error(payload.message);
  }
  return payload;
}
function getResults(payload) {
  return Array.isArray(payload?.results) ? payload.results : [];
}
async function getMeals({ query = "", category = "", area = "" } = {}) {
  const search = query.trim();
  const path = search
    ? "meals/search"
    : category || area
      ? "meals/filter"
      : "meals/random";
  const params = search
    ? { q: search }
    : category || area
      ? { category, area, limit: 25 }
      : { count: 25 };
  return getResults(await request(path, params));
}
async function getMealCategories() {
  return getResults(await request("meals/categories"));
}
async function getItem(path, label) {
  const payload = await request(path);
  if (!payload?.result) throw new Error(`${label} was not found.`);
  return payload.result;
}
function getMeal(id) {
  return getItem(`meals/${encodeURIComponent(id)}`, "Recipe");
}
async function getProductCategories() {
  return getResults(await request("products/categories", { limit: 50 }));
}
async function getProducts(query) {
  return getResults(await request("products/search", { q: query.trim() }));
}
async function getProductsByCategory(category) {
  return getResults(
    await request(`products/category/${encodeURIComponent(category)}`, {
      limit: 24,
    }),
  );
}
function getProduct(barcode) {
  return getItem(`products/barcode/${encodeURIComponent(barcode)}`, "Product");
}
async function analyzeNutrition(recipeName, ingredients, apiKey) {
  if (!apiKey) {
    throw new Error("A USDA API key is required for nutrition analysis.");
  }
  const url = new URL("nutrition/analyze", API_BASE_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ recipeName, ingredients }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Nutrition analysis failed (${response.status}).`,
    );
  }
  return payload?.data;
}
const {
  renderCategories,
  renderFoodLog,
  renderMeals,
  renderProductCategories,
  renderProducts,
} = window.NutriPlanComponents;
const API_KEY_STORAGE = "nutriplan-usda-api-key";
const FOOD_LOG_PREFIX = "nutriplan-food-log-";
const GOALS = { calories: 2000, protein: 50, carbs: 250, fat: 65 };
const DEMO_NUTRITION = {
  calories: 2152,
  protein: 111,
  carbs: 201,
  fat: 132,
};
const ui = {
  loading: document.querySelector("#app-loading-overlay"),
  header: document.querySelector("#header"),
  sidebar: document.querySelector("#sidebar"),
  sidebarOverlay: document.querySelector("#sidebar-overlay"),
  search: document.querySelector("#search-input"),
  cuisineFilters: document.querySelector(
    "#search-filters-section .overflow-x-auto",
  ),
  categories: document.querySelector("#categories-grid"),
  recipes: document.querySelector("#recipes-grid"),
  recipeCount: document.querySelector("#recipes-count"),
  details: document.querySelector("#meal-details"),
  productsSection: document.querySelector("#products-section"),
  productSearch: document.querySelector("#product-search-input"),
  productSearchButton: document.querySelector("#search-product-btn"),
  barcode: document.querySelector("#barcode-input"),
  barcodeButton: document.querySelector("#lookup-barcode-btn"),
  productCategories: document.querySelector("#product-categories"),
  productCount: document.querySelector("#products-count"),
  products: document.querySelector("#products-grid"),
  foodLogSection: document.querySelector("#foodlog-section"),
  foodLogDate: document.querySelector("#foodlog-date"),
  foodLogItems: document.querySelector("#logged-items-list"),
  clearFoodLog: document.querySelector("#clear-foodlog"),
  weeklyChart: document.querySelector("#weekly-chart"),
  searchSection: document.querySelector("#search-filters-section"),
  categoriesSection: document.querySelector("#meal-categories-section"),
  recipesSection: document.querySelector("#all-recipes-section"),
};
const DEFAULT_NUTRITION_MARKUP =
  ui.details?.querySelector("#nutrition-facts-container")?.innerHTML || "";
const state = {
  mealFilter: { query: "", category: "", area: "" },
  mealsRequest: 0,
  products: [],
  productsRequest: 0,
  selectedGrade: "",
  productCategoriesLoaded: false,
  currentMeal: null,
};
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}
function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "0";
}
function displayError(container, message) {
  container.innerHTML = `<p class="col-span-full py-10 text-center text-red-600">${escapeHtml(message)}</p>`;
}
function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function readFoodLog(date = new Date()) {
  const stored = localStorage.getItem(
    `${FOOD_LOG_PREFIX}${localDateKey(date)}`,
  );
  if (!stored) return [];
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error("Saved food log data is invalid.");
  }
  return parsed;
}
function saveFoodLog(items) {
  localStorage.setItem(
    `${FOOD_LOG_PREFIX}${localDateKey()}`,
    JSON.stringify(items),
  );
}
function notify(message, icon = "success") {
  if (window.Swal?.fire) {
    window.Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title: message,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    });
  } else {
    window.alert(message);
  }
}
function nutritionValue(item, nutrient) {
  return item.nutritionKnown ? Number(item.nutrients?.[nutrient]) || 0 : 0;
}
function hasNutritionData(nutrients) {
  return Object.values(nutrients || {}).some(
    (value) => value !== null && value !== "" && Number.isFinite(Number(value)),
  );
}
function addFoodLogEntry(entry, { notifySuccess = true } = {}) {
  try {
    const items = readFoodLog();
    items.unshift({
      ...entry,
      logId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      loggedAt: new Date().toISOString(),
    });
    saveFoodLog(items);
    refreshFoodLog();
    if (notifySuccess) notify("Added to your food log.");
    return true;
  } catch (error) {
    console.error("Could not save food log entry.", error);
    notify(`Could not save this entry: ${error.message}`, "error");
    return false;
  }
}
function refreshFoodLog() {
  let items;
  try {
    items = readFoodLog();
  } catch (error) {
    console.error("Could not read the food log.", error);
    displayError(
      ui.foodLogItems,
      "The saved food log is invalid. Clear it to start a new log.",
    );
    return;
  }
  renderFoodLog({
    items,
    goals: GOALS,
    dateElement: ui.foodLogDate,
    listElement: ui.foodLogItems,
    clearButton: ui.clearFoodLog,
  });

  renderWeeklyChart();
}
function renderWeeklyChart() {
  if (!ui.weeklyChart) return;
  if (!window.Plotly) {
    ui.weeklyChart.replaceChildren();
    return;
  }
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    let items = [];
    try {
      items = readFoodLog(date);
    } catch (error) {
      console.error(`Could not read food log for ${localDateKey(date)}.`, error);
    }
    return {
      items,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
    };
  });

  window.Plotly.newPlot(
    ui.weeklyChart,
    [
      {
        x: dates.map((day) => day.label),
        y: dates.map((day) =>
          day.items.reduce(
            (total, item) => total + nutritionValue(item, "calories"),
            0,
          ),
        ),
        type: "bar",
        marker: { color: "#10b981" },
        hovertemplate: "%{x}: %{y} kcal<extra></extra>",
      },
    ],
    {
      margin: { t: 12, r: 12, b: 32, l: 42 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      yaxis: { title: "kcal", rangemode: "tozero", gridcolor: "#e5e7eb" },
      xaxis: { fixedrange: true },
      font: { family: "Inter, sans-serif", color: "#6b7280" },
    },
    { responsive: true, displayModeBar: false },
  );
}

function closeSidebar() {
  ui.sidebar.classList.remove("open");
  ui.sidebarOverlay.classList.remove("open");
}

function setNavigation(page) {
  const routes = ["meals", "products", "foodlog"];
  document.querySelectorAll(".nav-link").forEach((link, index) => {
    const active = routes[index] === page;
    link.classList.toggle("bg-emerald-50", active);
    link.classList.toggle("text-emerald-700", active);
    link.classList.toggle("text-gray-600", !active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setRecipeView(view) {
  const isGrid = view === "grid";
  ui.recipes.classList.toggle("grid-cols-4", isGrid);
  ui.recipes.classList.toggle("grid-cols-1", !isGrid);
  [["#grid-view-btn", isGrid], ["#list-view-btn", !isGrid]].forEach(
    ([selector, active]) => {
      const button = document.querySelector(selector);
      button?.classList.toggle("bg-white", active);
      button?.classList.toggle("shadow-sm", active);
      button?.querySelector("i")?.classList.toggle("text-gray-700", active);
      button?.querySelector("i")?.classList.toggle("text-gray-500", !active);
    },
  );
}

function setPage(page) {
  const validPages = ["meals", "products", "foodlog"];
  if (!validPages.includes(page)) return;
  const isMeals = page === "meals";
  ui.searchSection.hidden = !isMeals;
  ui.categoriesSection.hidden = !isMeals;
  ui.recipesSection.hidden = !isMeals;
  ui.details.hidden = true;
  ui.productsSection.hidden = page !== "products";
  ui.foodLogSection.hidden = page !== "foodlog";

  const headings = {
    meals: [
      "Meals & Recipes",
      "Discover delicious and nutritious recipes tailored for you",
    ],
    products: [
      "Product Scanner",
      "Search for packaged foods and view nutrition information",
    ],
    foodlog: ["Food Log", "Track and monitor your daily nutrition intake"],
  };
  const [title, description] = headings[page];
  ui.header.querySelector("h1").textContent = title;
  ui.header.querySelector("p").textContent = description;
  setNavigation(page);
  closeSidebar();

  if (page === "products") {
    loadProductCategories();
    if (!state.products.length) loadProductsByCategory("snacks");
  } else if (page === "foodlog") {
    refreshFoodLog();
  }
}

function setMealFilter({ query = "", category = "", area = "" } = {}) {
  state.mealFilter = { query, category, area };
  loadMeals();
}

async function loadMeals() {
  const requestId = ++state.mealsRequest;
  ui.recipes.innerHTML =
    '<p class="col-span-full py-10 text-center text-gray-500">Loading recipes...</p>';
  try {
    const meals = await getMeals(state.mealFilter);
    if (requestId !== state.mealsRequest) return;
    renderMeals(ui.recipes, meals);
    ui.recipeCount.textContent = `Showing ${meals.length} ${
      meals.length === 1 ? "recipe" : "recipes"
    }`;
  } catch (error) {
    if (requestId !== state.mealsRequest) return;
    console.error("Could not load recipes.", error);
    ui.recipeCount.textContent = "Could not load recipes";
    displayError(ui.recipes, `Could not load recipes: ${error.message}`);
  }
}

async function loadCategories() {
  try {
    renderCategories(ui.categories, await getMealCategories());
  } catch (error) {
    console.error("Could not load meal categories.", error);
    displayError(
      ui.categories,
      `Could not load meal categories: ${error.message}`,
    );
  }
}

function setupCuisineFilters() {
  ui.cuisineFilters.classList.remove("grid");
  ui.cuisineFilters.classList.add("flex", "items-center", "overflow-x-auto");

  const filters = [
    ["All Recipes", ""],
    ["Egyptian", "Egyptian"],
    ["Italian", "Italian"],
    ["Indian", "India"],
    ["Chinese", "Chinese"],
    ["Japanese", "Japanese"],
    ["Mexican", "Mexican"],
    ["American", "United States"],
    ["British", "British"],
    ["French", "France"],
  ];
  ui.cuisineFilters.innerHTML = filters
    .map(([label, area], index) => `
        <button type="button" data-area="${escapeHtml(area)}"
          class="cuisine-filter px-4 py-2 ${index === 0 ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"} rounded-full font-medium text-sm whitespace-nowrap hover:bg-gray-200 transition-all">
          ${escapeHtml(label)}
        </button>`,
    )
    .join("");
}

async function loadProductCategories() {
  if (state.productCategoriesLoaded) return;
  try {
    renderProductCategories(
      ui.productCategories,
      await getProductCategories(),
    );
    state.productCategoriesLoaded = true;
  } catch (error) {
    console.error("Could not load product categories.", error);
    displayError(
      ui.productCategories,
      `Could not load product categories: ${error.message}`,
    );
  }
}

function visibleProducts() {
  if (!state.selectedGrade) return state.products;
  return state.products.filter(
    (product) =>
      String(product.nutritionGrade || "").toLowerCase() ===
      state.selectedGrade,
  );
}

function showProducts(products) {
  state.products = products;
  const visible = visibleProducts();
  renderProducts(ui.products, visible);
  ui.productCount.textContent = `${visible.length} ${
    visible.length === 1 ? "product" : "products"
  }`;
}

async function runProductRequest(operation, loadingMessage, errorLabel) {
  const requestId = ++state.productsRequest;
  ui.products.innerHTML = `<p class="col-span-full py-10 text-center text-gray-500">${escapeHtml(loadingMessage)}</p>`;
  try {
    const products = await operation();
    if (requestId !== state.productsRequest) return;
    showProducts(products);
  } catch (error) {
    if (requestId !== state.productsRequest) return;
    console.error(errorLabel, error);
    ui.productCount.textContent = "Could not load products";
    displayError(ui.products, `${errorLabel}: ${error.message}`);
  }
}

function searchProducts() {
  const query = ui.productSearch.value.trim();
  if (!query) {
    ui.productCount.textContent = "Search for products to see results";
    ui.products.innerHTML = "";
    return;
  }
  runProductRequest(
    () => getProducts(query),
    "Searching products...",
    "Could not search products",
  );
}

function lookupBarcode() {
  const barcode = ui.barcode.value.trim();
  if (!/^\d{8,14}$/.test(barcode)) {
    notify("Enter a valid barcode (8 to 14 digits).", "warning");
    ui.barcode.focus();
    return;
  }
  runProductRequest(
    async () => [await getProduct(barcode)],
    "Looking up barcode...",
    "Could not find this barcode",
  );
}

function findHeading(container, label) {
  return Array.from(container.querySelectorAll("h1,h2,h3")).find((heading) =>
    heading.textContent.trim().startsWith(label),
  );
}

function renderIngredients(meal) {
  const heading = findHeading(ui.details, "Ingredients");
  if (!heading) return;
  const card = heading.closest(".bg-white");
  const grid = card?.querySelector(".grid");
  const counter = heading.querySelector("span");
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  if (counter) counter.textContent = `${ingredients.length} items`;
  if (!grid) return;
  grid.innerHTML = ingredients
    .map(
      (item) => `
        <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors">
          <input type="checkbox" class="ingredient-checkbox w-5 h-5 text-emerald-600 rounded border-gray-300" />
          <span class="text-gray-700">
            <span class="font-medium text-gray-900">${escapeHtml(item.measure || "")}</span>
            ${escapeHtml(item.ingredient || "")}
          </span>
        </label>`,
    )
    .join("");
}

function renderInstructions(meal) {
  const heading = findHeading(ui.details, "Instructions");
  const stepsContainer = heading?.parentElement?.querySelector(".space-y-4");
  const instructions = Array.isArray(meal.instructions)
    ? meal.instructions
    : [];
  if (!stepsContainer) return;
  stepsContainer.innerHTML = instructions
    .map(
      (step, index) => `
        <div class="flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
          <div class="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">${index + 1}</div>
          <p class="text-gray-700 leading-relaxed pt-2">${escapeHtml(step)}</p>
        </div>`,
    )
    .join("");
}

function renderHero(meal) {
  const image = ui.details.querySelector(".relative.h-80 img");
  const title = ui.details.querySelector(".relative.h-80 h1");
  const tags = ui.details.querySelector(".relative.h-80 .bottom-0 .flex");
  if (image) {
    image.src = meal.thumbnail || "";
    image.alt = meal.name || "Recipe";
  }
  if (title) title.textContent = meal.name || "Recipe";
  if (tags) {
    const labels = [meal.category, meal.area, ...(meal.tags || [])]
      .filter(Boolean)
      .slice(0, 5);
    tags.innerHTML = labels
      .map(
        (label, index) => `
          <span class="px-3 py-1 ${
            index === 0
              ? "bg-emerald-500"
              : index === 1
                ? "bg-blue-500"
                : "bg-purple-500"
          } text-white text-sm font-semibold rounded-full">${escapeHtml(label)}</span>`,
      )
      .join("");
  }
  const servings = ui.details.querySelector("#hero-servings");
  const calories = ui.details.querySelector("#hero-calories");
  if (servings) servings.textContent = "4 servings";
  if (calories) calories.textContent = "Nutrition unavailable";
  const clock = ui.details.querySelector(".fa-clock");
  const timeLabel = clock?.parentElement?.querySelector("span");
  if (timeLabel) timeLabel.textContent = "— min";
}

function renderVideo(meal) {
  const section = findHeading(ui.details, "Video Tutorial")?.closest(".bg-white");
  const iframe = section?.querySelector("iframe");
  if (!section || !iframe || !meal.youtube) {
    if (section) section.hidden = true;
    return;
  }
  try {
    const videoUrl = new URL(meal.youtube);
    const videoId = videoUrl.hostname.includes("youtu.be")
      ? videoUrl.pathname.slice(1)
      : videoUrl.searchParams.get("v");
    if (!videoId) {
      section.hidden = true;
      return;
    }
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
    iframe.title = `${meal.name} video tutorial`;
    section.hidden = false;
  } catch (error) {
    console.error("Recipe video URL is invalid.", error);
    section.hidden = true;
  }
}

function renderNutrition(meal) {
  const container = ui.details.querySelector("#nutrition-facts-container");
  if (!container) return;
  let apiKey = "";
  try {
    apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  } catch (error) {
    console.error("Could not read the optional USDA API key.", error);
  }
  if (!apiKey) {
    if (DEFAULT_NUTRITION_MARKUP) {
      container.innerHTML = DEFAULT_NUTRITION_MARKUP;
      container.insertAdjacentHTML(
        "beforeend",
        '<p class="mt-4 text-xs text-gray-500">Fictional demo values; not calculated for this recipe.</p>',
      );
      const heroCalories = ui.details.querySelector("#hero-calories");
      if (heroCalories) heroCalories.textContent = "485 cal/serving";
      return;
    }
    container.innerHTML = `
      <p class="text-sm text-gray-500">
        Nutrition analysis requires a USDA API key.
        <a class="text-emerald-700 underline" href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noreferrer">Get a free key</a>.
      </p>`;
    return;
  }

  container.innerHTML =
    '<p class="text-sm text-gray-500">Analyzing recipe nutrition...</p>';
  analyzeNutrition(
    meal.name,
    (meal.ingredients || []).map((item) =>
      `${item.measure || ""} ${item.ingredient || ""}`.trim(),
    ),
    apiKey,
  )
    .then((analysis) => {
      if (ui.details.hidden) return;
      const facts = analysis?.perServing;
      if (!facts) throw new Error("The API returned no nutrition data.");
      const nutrients = [
        ["Protein", "protein", "emerald"],
        ["Carbs", "carbs", "blue"],
        ["Fat", "fat", "purple"],
        ["Fiber", "fiber", "orange"],
        ["Sugar", "sugar", "pink"],
      ];
      container.innerHTML = `
        <p class="text-sm text-gray-500 mb-4">Per serving</p>
        <div class="text-center py-4 mb-4 bg-linear-to-br from-emerald-50 to-teal-50 rounded-xl">
          <p class="text-sm text-gray-600">Calories per serving</p>
          <p class="text-4xl font-bold text-emerald-600">${formatNumber(facts.calories, 0)}</p>
          <p class="text-xs text-gray-500 mt-1">Total: ${formatNumber(analysis.totals?.calories, 0)} cal</p>
        </div>
        <div class="space-y-4">
          ${nutrients
            .map(
              ([label, key, color]) => `
                <div class="flex items-center justify-between">
                  <span class="text-gray-700">${label}</span>
                  <span class="font-bold text-gray-900">${formatNumber(facts[key])}g</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div class="bg-${color}-500 h-2 rounded-full" style="width:${Math.min(100, (Number(facts[key]) || 0) * 2)}%"></div>
                </div>`,
            )
            .join("")}
        </div>`;
      const heroCalories = ui.details.querySelector("#hero-calories");
      if (heroCalories) {
        heroCalories.textContent = `${formatNumber(facts.calories, 0)} cal/serving`;
      }
    })
    .catch((error) => {
      console.error("Could not analyze recipe nutrition.", error);
      container.innerHTML = `<p class="text-sm text-red-600">Nutrition analysis failed: ${escapeHtml(error.message)}</p>`;
    });
}

async function showMealDetails(id) {
  ui.searchSection.hidden = true;
  ui.categoriesSection.hidden = true;
  ui.recipesSection.hidden = true;
  ui.details.hidden = false;
  ui.header.querySelector("h1").textContent = "Recipe Details";
  ui.header.querySelector("p").textContent =
    "Ingredients and preparation instructions";

  const detailsGrid = ui.details.querySelector(".grid.grid-cols-1.lg\\:grid-cols-3");
  detailsGrid?.classList.add("opacity-50");
  detailsGrid?.setAttribute("aria-busy", "true");
  try {
    const meal = await getMeal(id);
    state.currentMeal = meal;
    renderHero(meal);
    renderIngredients(meal);
    renderInstructions(meal);
    renderVideo(meal);
    renderNutrition(meal);
    ui.details.querySelector("#log-meal-btn")?.setAttribute("data-meal-id", meal.id);
  } catch (error) {
    console.error("Could not load recipe details.", error);
    notify(`Could not load recipe: ${error.message}`, "error");
    setPage("meals");
  } finally {
    detailsGrid?.classList.remove("opacity-50");
    detailsGrid?.removeAttribute("aria-busy");
  }
}

function logCurrentMeal() {
  const id = ui.details.querySelector("#log-meal-btn")?.dataset.mealId;
  if (!id) return;
  const meal = state.currentMeal;
  if (meal && String(meal.id) === String(id)) {
    showLogMealDialog(meal);
  } else {
    getMeal(id)
      .then((detail) => {
        state.currentMeal = detail;
        showLogMealDialog(detail);
      })
      .catch((error) => notify(`Could not load recipe: ${error.message}`, "error"));
  }
}

function showLogMealDialog(meal) {
  document.querySelector("#log-meal-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "log-meal-modal";
  modal.className =
    "fixed inset-0 z-50 flex items-center justify-center bg-black/50";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "log-meal-title");
  modal.innerHTML = `
    <div class="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <div class="mb-6 flex items-center gap-4">
        <img src="${escapeHtml(meal.thumbnail || "")}" alt="${escapeHtml(meal.name)}" class="h-16 w-16 rounded-xl object-cover">
        <div>
          <h2 id="log-meal-title" class="text-xl font-bold text-gray-900">Log This Meal</h2>
          <p class="text-sm text-gray-500">${escapeHtml(meal.name)}</p>
        </div>
      </div>
      <div class="mb-6">
        <label for="meal-servings" class="mb-2 block text-sm font-semibold text-gray-700">Number of Servings</label>
        <div class="flex items-center gap-3">
          <button type="button" id="decrease-servings" aria-label="Decrease servings" class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200">
            <i class="fa-solid fa-minus text-gray-600"></i>
          </button>
          <input type="number" id="meal-servings" value="1" min="0.5" max="10" step="0.5" class="w-20 rounded-lg border-2 border-gray-200 py-2 text-center text-xl font-bold">
          <button type="button" id="increase-servings" aria-label="Increase servings" class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200">
            <i class="fa-solid fa-plus text-gray-600"></i>
          </button>
        </div>
      </div>
      <div class="mb-6 rounded-xl bg-emerald-50 p-4">
        <p class="mb-2 text-sm text-gray-600">Estimated nutrition per serving:</p>
        <div id="meal-nutrition-preview" class="grid grid-cols-4 gap-2 text-center">
          ${[
            ["Calories", "calories", "emerald"],
            ["Protein", "protein", "blue"],
            ["Carbs", "carbs", "amber"],
            ["Fat", "fat", "purple"],
          ]
            .map(
              ([label, key, color]) => `
                <div>
                  <p class="text-lg font-bold text-${color}-600" data-preview-nutrient="${key}">—</p>
                  <p class="text-xs text-gray-500">${label}</p>
                </div>`,
            )
            .join("")}
        </div>
        <p id="meal-nutrition-status" class="mt-2 text-center text-xs text-gray-500">Nutrition data unavailable; the meal and serving count can still be logged.</p>
      </div>
      <div class="flex gap-3">
        <button type="button" id="cancel-log-meal" class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-200">Cancel</button>
        <button type="button" id="confirm-log-meal" class="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-700">
          <i class="fa-solid fa-clipboard-list mr-2"></i>Log Meal
        </button>
      </div>
    </div>`;
  document.body.append(modal);

  const servingsInput = modal.querySelector("#meal-servings");
  let perServing = null;
  let isDemoNutrition = false;
  let nutritionRequest = 0;
  const updatePreview = () => {
    for (const key of ["calories", "protein", "carbs", "fat"]) {
      const value = perServing?.[key];
      const output = modal.querySelector(`[data-preview-nutrient="${key}"]`);
      output.textContent =
        value === null || value === undefined ? "—" : formatNumber(value);
    }
  };
  const close = () => modal.remove();
  const clampServings = () => {
    const parsed = Number(servingsInput.value);
    const normalized = Number.isFinite(parsed)
      ? Math.min(10, Math.max(0.5, Math.round(parsed * 2) / 2))
      : 1;
    servingsInput.value = String(normalized);
    return normalized;
  };

  modal.querySelector("#decrease-servings").addEventListener("click", () => {
    servingsInput.value = String(Math.max(0.5, clampServings() - 0.5));
  });
  modal.querySelector("#increase-servings").addEventListener("click", () => {
    servingsInput.value = String(Math.min(10, clampServings() + 0.5));
  });
  servingsInput.addEventListener("change", clampServings);
  modal.querySelector("#cancel-log-meal").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  let apiKey = "";
  try {
    apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
  } catch (error) {
    console.error("Could not read the optional USDA API key.", error);
  }
  if (apiKey) {
    const requestId = ++nutritionRequest;
    modal.querySelector("#meal-nutrition-status").textContent =
      "Analyzing recipe nutrition...";
    analyzeNutrition(
      meal.name,
      (meal.ingredients || []).map((item) =>
        `${item.measure || ""} ${item.ingredient || ""}`.trim(),
      ),
      apiKey,
    )
      .then((analysis) => {
        if (!modal.isConnected || requestId !== nutritionRequest) return;
        perServing = analysis?.perServing || null;
        if (!perServing) throw new Error("The API returned no nutrition data.");
        updatePreview();
        modal.querySelector("#meal-nutrition-status").textContent =
          "USDA estimate per serving.";
      })
      .catch((error) => {
        console.error("Could not analyze nutrition for the food log.", error);
        if (modal.isConnected) {
          perServing = DEMO_NUTRITION;
          isDemoNutrition = true;
          updatePreview();
          modal.querySelector("#meal-nutrition-status").textContent =
            "Fictional demo values; USDA analysis failed.";
        }
      });
  } else {
    perServing = DEMO_NUTRITION;
    isDemoNutrition = true;
    updatePreview();
    modal.querySelector("#meal-nutrition-status").textContent =
      "Fictional demo values; not analyzed by USDA.";
  }

  modal.querySelector("#confirm-log-meal").addEventListener("click", () => {
    const servings = clampServings();
    const nutrients = perServing && !isDemoNutrition
      ? Object.fromEntries(
          Object.entries(perServing).map(([key, value]) => [
            key,
            (Number(value) || 0) * servings,
          ]),
        )
      : {};
    const logged = addFoodLogEntry(
      {
        id: meal.id,
        name: meal.name,
        type: "Recipe",
        servings,
        nutritionKnown: Boolean(perServing) && !isDemoNutrition,
        nutritionDemo: isDemoNutrition,
        nutrients,
      },
      { notifySuccess: false },
    );
    if (!logged) return;
    const calories = perServing
      ? `+${formatNumber((Number(perServing.calories) || 0) * servings, 0)} calories`
      : "Nutrition information is unavailable.";
    const nutritionNote = isDemoNutrition
      ? "<p class=\"mt-1 text-xs text-gray-500\">Fictional demo only; not included in nutrition totals.</p>"
      : "";
    if (window.Swal?.fire) {
      close();
      window.Swal.fire({
        title: "Meal Logged!",
        html: `<p>${escapeHtml(meal.name)} (${formatNumber(servings)} ${servings === 1 ? "serving" : "servings"}) has been added to your daily log.</p><p class="mt-2 font-semibold text-emerald-600">${calories}</p>${nutritionNote}`,
        icon: "success",
        confirmButtonColor: "#059669",
      });
    } else {
      modal.innerHTML = `
        <div class="mx-4 w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl" role="status">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            <i class="fa-solid fa-check"></i>
          </div>
          <h2 class="mb-2 text-2xl font-bold text-gray-900">Meal Logged!</h2>
          <p class="text-gray-600">${escapeHtml(meal.name)} (${formatNumber(servings)} ${servings === 1 ? "serving" : "servings"}) has been added to your daily log.</p>
          <p class="mt-2 font-semibold text-emerald-600">${calories}</p>
          ${nutritionNote}
          <button type="button" class="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700" data-close-meal-confirmation>OK</button>
        </div>`;
      modal
        .querySelector("[data-close-meal-confirmation]")
        .addEventListener("click", close);
    }
  });
}

function createCustomFoodDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "rounded-2xl p-6 shadow-xl";
  dialog.style.width = "min(92vw, 28rem)";
  dialog.innerHTML = `
    <form class="space-y-4">
      <h2 class="text-xl font-bold text-gray-900">Add custom food</h2>
      <label class="block text-sm font-medium text-gray-700">Food name
        <input name="name" required maxlength="100" class="mt-1 w-full rounded-lg border border-gray-300 p-2">
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block text-sm font-medium text-gray-700">Calories
          <input name="calories" type="number" min="0" step="any" required class="mt-1 w-full rounded-lg border border-gray-300 p-2">
        </label>
        <label class="block text-sm font-medium text-gray-700">Protein (g)
          <input name="protein" type="number" min="0" step="any" class="mt-1 w-full rounded-lg border border-gray-300 p-2">
        </label>
        <label class="block text-sm font-medium text-gray-700">Carbs (g)
          <input name="carbs" type="number" min="0" step="any" class="mt-1 w-full rounded-lg border border-gray-300 p-2">
        </label>
        <label class="block text-sm font-medium text-gray-700">Fat (g)
          <input name="fat" type="number" min="0" step="any" class="mt-1 w-full rounded-lg border border-gray-300 p-2">
        </label>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="cancel-custom-food rounded-lg px-4 py-2 text-gray-600">Cancel</button>
        <button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Add food</button>
      </div>
    </form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector(".cancel-custom-food").addEventListener("click", () => {
    dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    addFoodLogEntry({
      id: `custom-${Date.now()}`,
      name: String(formData.get("name")).trim(),
      type: "Custom entry",
      nutritionKnown: true,
      nutrients: {
        calories: Number(formData.get("calories")) || 0,
        protein: Number(formData.get("protein")) || 0,
        carbs: Number(formData.get("carbs")) || 0,
        fat: Number(formData.get("fat")) || 0,
      },
    });
    dialog.close();
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach((link, index) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setPage(["meals", "products", "foodlog"][index]);
    });
  });

  document.querySelector("#header-menu-btn")?.addEventListener("click", () => {
    ui.sidebar.classList.toggle("open");
    ui.sidebarOverlay.classList.toggle("open");
  });
  document.querySelector("#sidebar-close-btn")?.addEventListener("click", closeSidebar);
  ui.sidebarOverlay.addEventListener("click", closeSidebar);

  let searchTimer;
  ui.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(
      () => setMealFilter({ query: ui.search.value.trim() }),
      350,
    );
  });
  ui.search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    window.clearTimeout(searchTimer);
    setMealFilter({ query: ui.search.value.trim() });
  });

  const initialCuisineButtons = ui.cuisineFilters.querySelectorAll("button");
  if (initialCuisineButtons[0]) initialCuisineButtons[0].dataset.area = "";
  if (initialCuisineButtons[1]) initialCuisineButtons[1].dataset.area = "Egyptian";
  ui.cuisineFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-area]");
    if (!button) return;
    ui.search.value = "";
    ui.cuisineFilters.querySelectorAll("[data-area]").forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle("bg-emerald-600", active);
      filter.classList.toggle("text-white", active);
      filter.classList.toggle("bg-gray-100", !active);
      filter.classList.toggle("text-gray-700", !active);
    });
    setMealFilter({ area: button.dataset.area || "" });
  });

  ui.categories.addEventListener("click", (event) => {
    const category = event.target.closest("[data-category]");
    if (!category) return;
    ui.search.value = "";
    setMealFilter({ category: category.dataset.category });
    ui.recipesSection.scrollIntoView({ behavior: "smooth" });
  });

  ui.recipes.addEventListener("click", (event) => {
    const card = event.target.closest("[data-meal-id]");
    if (card) showMealDetails(card.dataset.mealId);
  });
  ui.details.querySelector("#back-to-meals-btn")?.addEventListener("click", () => {
    setPage("meals");
  });
  ui.details.querySelector("#log-meal-btn")?.addEventListener("click", logCurrentMeal);

  document
    .querySelector("#meal-categories-section button")
    ?.addEventListener("click", () => {
      ui.search.value = "";
      setMealFilter();
    });
  document.querySelector("#grid-view-btn")?.addEventListener("click", () => {
    setRecipeView("grid");
  });
  document.querySelector("#list-view-btn")?.addEventListener("click", () => {
    setRecipeView("list");
  });

  ui.productSearchButton.addEventListener("click", searchProducts);
  ui.productSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchProducts();
  });
  ui.barcodeButton.addEventListener("click", lookupBarcode);
  ui.barcode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") lookupBarcode();
  });

  ui.productCategories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-category]");
    if (!button) return;
    ui.productSearch.value = "";
    runProductRequest(
      () => getProductsByCategory(button.dataset.productCategory),
      "Loading products...",
      "Could not load this category",
    );
  });

  document.querySelectorAll(".nutri-score-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGrade = button.dataset.grade || "";
      document.querySelectorAll(".nutri-score-filter").forEach((filter) => {
        filter.classList.toggle("ring-2", filter === button);
        filter.classList.toggle("ring-emerald-600", filter === button);
      });
      renderProducts(ui.products, visibleProducts());
      ui.productCount.textContent = `${visibleProducts().length} products`;
    });
  });

  ui.products.addEventListener("click", (event) => {
    const logButton = event.target.closest("[data-log-barcode]");
    if (logButton) {
      const product = state.products.find(
        (item) => item.barcode === logButton.dataset.logBarcode,
      );
      if (product) {
        const nutrients = product.nutrients || {};
        addFoodLogEntry({
          id: product.barcode,
          name: product.name,
          type: "Product (100 g)",
          nutritionKnown: hasNutritionData(nutrients),
          nutrients,
        });
      }
      return;
    }
  });

  ui.clearFoodLog.addEventListener("click", () => {
    try {
      saveFoodLog([]);
      refreshFoodLog();
      notify("Today's food log was cleared.");
    } catch (error) {
      console.error("Could not clear food log.", error);
      notify(error.message, "error");
    }
  });
  ui.foodLogItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-log]");
    if (!button) return;
    try {
      saveFoodLog(
        readFoodLog().filter((item) => item.logId !== button.dataset.removeLog),
      );
      refreshFoodLog();
    } catch (error) {
      console.error("Could not remove food log entry.", error);
      notify(error.message, "error");
    }
  });

  document.querySelectorAll(".quick-log-btn").forEach((button, index) => {
    button.addEventListener("click", () => {
      if (index === 0) setPage("meals");
      if (index === 1) setPage("products");
      if (index === 2) createCustomFoodDialog();
    });
  });
}

async function initialize() {
  ui.details.hidden = true;
  ui.productsSection.hidden = true;
  ui.foodLogSection.hidden = true;
  ui.weeklyChart?.replaceChildren();
  ui.recipes.innerHTML = "";
  ui.categories.innerHTML = "";
  ui.products.innerHTML = "";
  bindEvents();
  setRecipeView("grid");
  setupCuisineFilters();
  setNavigation("meals");
  await Promise.all([loadMeals(), loadCategories()]);
  ui.loading?.classList.add("hidden");
}

initialize().catch((error) => {
  console.error("NutriPlan initialization failed.", error);
  ui.loading?.classList.add("hidden");
  displayError(ui.recipes, `Could not start the app: ${error.message}`);
});
})();
