(() => {
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

function displayNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—";
}

const CATEGORY_STYLES = {
  Beef: ["#fff1f2", "#fecdd3", "#f43f5e", "fa-drumstick-bite"],
  Chicken: ["#fffbeb", "#fde68a", "#f59e0b", "fa-drumstick-bite"],
  Dessert: ["#fdf2f8", "#fbcfe8", "#ec4899", "fa-cake-candles"],
  Lamb: ["#fff7ed", "#fed7aa", "#f97316", "fa-drumstick-bite"],
  Miscellaneous: ["#f8fafc", "#e2e8f0", "#64748b", "fa-bowl-food"],
  Pasta: ["#fefce8", "#fef08a", "#eab308", "fa-bowl-food"],
  Pork: ["#fff1f2", "#fecdd3", "#f43f5e", "fa-bacon"],
  Seafood: ["#f0f9ff", "#bae6fd", "#0ea5e9", "fa-fish"],
  Side: ["#ecfdf5", "#a7f3d0", "#10b981", "fa-plate-wheat"],
  Starter: ["#ecfeff", "#a5f3fc", "#06b6d4", "fa-utensils"],
  Vegan: ["#f0fdf4", "#bbf7d0", "#22c55e", "fa-leaf"],
  Vegetarian: ["#f7fee7", "#d9f99d", "#84cc16", "fa-seedling"],
  Breakfast: ["#fffbeb", "#fde68a", "#f59e0b", "fa-egg"],
  Goat: ["#fff7ed", "#fed7aa", "#f97316", "fa-drumstick-bite"],
};

function renderCategories(container, categories) {
  if (!categories.length) {
    container.innerHTML = '<p class="col-span-full py-8 text-center text-gray-500">No meal categories found.</p>';
    return;
  }

  container.innerHTML = categories
    .map((category, index) => {
      const [background, border, accent, icon] =
        CATEGORY_STYLES[category.name] ||
        ["#ecfdf5", "#a7f3d0", "#10b981", "fa-utensils"];
      const hidden = index >= 12;
      return `
        <button type="button" data-category="${escapeHtml(category.name)}"
          ${hidden ? "data-extra-category hidden" : ""}
          class="category-card flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all hover:shadow-md"
          style="background:${background};border-color:${border}">
          <span aria-hidden="true"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style="background:linear-gradient(135deg,${accent},${accent}dd)">
            <i class="fa-solid ${icon}"></i>
          </span>
          <span class="text-sm font-bold text-gray-900">${escapeHtml(category.name)}</span>
        </button>`;
    })
    .join("");

  const viewAllButton = container
    .closest("#meal-categories-section")
    ?.querySelector("button");
  if (!viewAllButton || viewAllButton.dataset.categoryToggleBound) return;
  viewAllButton.dataset.categoryToggleBound = "true";
  viewAllButton.addEventListener("click", () => {
    const expanded = viewAllButton.dataset.expanded !== "true";
    viewAllButton.dataset.expanded = String(expanded);
    container.querySelectorAll("[data-extra-category]").forEach((category) => {
      category.hidden = !expanded;
    });
    viewAllButton.innerHTML = expanded
      ? 'Show Less <i class="fa-solid fa-chevron-up text-xs"></i>'
      : 'View All <i class="fa-solid fa-chevron-right text-xs"></i>';
  });
}

function renderMeals(container, meals) {
  if (!meals.length) {
    container.innerHTML = '<p class="col-span-full py-10 text-center text-gray-500">No recipes found. Try another search or filter.</p>';
    return;
  }

  container.innerHTML = meals
    .map(
      (meal) => `
        <button type="button" data-meal-id="${escapeHtml(meal.id)}"
          class="recipe-card group overflow-hidden rounded-xl bg-white text-left shadow-sm transition-all hover:shadow-lg">
          <div class="relative h-48 overflow-hidden bg-gray-100">
            <img class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              src="${escapeHtml(meal.thumbnail || "")}" alt="${escapeHtml(meal.name)}" loading="lazy" />
            <div class="absolute bottom-3 left-3 flex gap-2">
              <span class="rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-gray-700">${escapeHtml(meal.category || "Recipe")}</span>
              <span class="rounded-full bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">${escapeHtml(meal.area || "Cuisine")}</span>
            </div>
          </div>
          <div class="p-4">
            <h3 class="mb-1 line-clamp-1 text-base font-bold text-gray-900 transition-colors group-hover:text-emerald-600">${escapeHtml(meal.name)}</h3>
            <p class="mb-3 line-clamp-2 text-xs text-gray-600">${escapeHtml(meal.instructions?.[0] || meal.tags?.join(", ") || "Discover this recipe and its ingredients.")}</p>
            <div class="flex items-center justify-between text-xs text-gray-600">
              <span><i class="fa-solid fa-utensils mr-1 text-emerald-600"></i>${escapeHtml(meal.category || "Meal")}</span>
              <span><i class="fa-solid fa-globe mr-1 text-blue-500"></i>${escapeHtml(meal.area || "Various")}</span>
            </div>
          </div>
        </button>`,
    )
    .join("");
}

function renderProductCategories(container, categories) {
  container.innerHTML = categories
    .map(
      (category) => `
        <button type="button" data-product-category="${escapeHtml(category.id)}"
          class="product-category-btn whitespace-nowrap rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-200">
          ${escapeHtml(category.name)}
        </button>`,
    )
    .join("");
}

function renderProducts(container, products) {
  if (!products.length) {
    container.innerHTML = '<p class="col-span-full py-10 text-center text-gray-500">No products match this search or filter.</p>';
    return;
  }

  container.innerHTML = products
    .map((product) => {
      const nutrients = product.nutrients || {};
      const grade = product.nutritionGrade?.toUpperCase();
      const nutrientCards = [
        ["protein", "Protein", "emerald"],
        ["carbs", "Carbs", "blue"],
        ["fat", "Fat", "purple"],
        ["sugar", "Sugar", "orange"],
      ];
      return `
        <article data-product-barcode="${escapeHtml(product.barcode)}" class="product-card group overflow-hidden rounded-xl bg-white shadow-sm transition-all hover:shadow-lg cursor-pointer">
          <div class="relative flex h-40 items-center justify-center overflow-hidden bg-gray-100">
            ${
              product.image
                ? `<img class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
                : '<span class="text-gray-400"><i class="fa-solid fa-box-open text-4xl"></i></span>'
            }
            ${
              grade
                ? `<span class="absolute left-2 top-2 rounded ${grade === "A" || grade === "B" ? "bg-green-600" : grade === "C" ? "bg-yellow-500" : "bg-red-600"} px-2 py-1 text-xs font-bold uppercase text-white">Nutri-Score ${escapeHtml(grade)}</span>`
                : ""
            }
            ${
              product.novaGroup
                ? `<span class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-lime-500 text-xs font-bold text-white" title="NOVA ${escapeHtml(product.novaGroup)}">${escapeHtml(product.novaGroup)}</span>`
                : ""
            }
          </div>
          <div class="p-4">
            <p class="mb-1 truncate text-xs font-semibold text-emerald-600">${escapeHtml(product.brand || "Product")}</p>
            <h3 class="mb-2 line-clamp-2 font-bold text-gray-900">${escapeHtml(product.name || "Unnamed product")}</h3>
            <p class="mb-3 text-xs text-gray-500"><i class="fa-solid fa-fire mr-1"></i>${displayNumber(nutrients.calories)} kcal / 100 g</p>
            <div class="mb-4 grid grid-cols-4 gap-1 text-center">
              ${nutrientCards
                .map(
                  ([key, label, color]) => `
                    <div class="rounded bg-${color}-50 p-1.5">
                      <p class="text-xs font-bold text-${color}-700">${displayNumber(nutrients[key])}g</p>
                      <p class="text-[10px] text-gray-500">${label}</p>
                    </div>`,
                )
                .join("")}
            </div>
            <button type="button" data-log-barcode="${escapeHtml(product.barcode)}" class="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
              <i class="fa-solid fa-plus mr-1"></i>Log 100 g
            </button>
          </div>
        </article>`;
    })
    .join("");
}

function renderFoodLog({ items, goals, dateElement, listElement, clearButton }) {
  const today = new Date();
  dateElement.textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const countHeading = document.querySelector("#foodlog-today-section h4");
  countHeading.textContent = `Logged Items (${items.length})`;
  clearButton.style.display = items.length ? "" : "none";

  const progressCards = document.querySelectorAll(
    "#foodlog-today-section > div.grid > div",
  );
  ["calories", "protein", "carbs", "fat"].forEach((key, index) => {
    const card = progressCards[index];
    if (!card) return;
    const amount = items.reduce(
      (total, item) =>
        total + (item.nutritionKnown ? Number(item.nutrients?.[key]) || 0 : 0),
      0,
    );
    const valueElement = card.querySelector(
      ".flex.items-center.justify-between span:last-child",
    );
    const bar = card.querySelector(".w-full > div");
    const unit = key === "calories" ? "kcal" : "g";
    if (valueElement) {
      valueElement.textContent = `${displayNumber(amount)} / ${displayNumber(goals[key])} ${unit}`;
    }
    if (bar) {
      bar.style.width = `${Math.min(100, (amount / goals[key]) * 100)}%`;
    }
  });

  if (!items.length) {
    listElement.innerHTML = `
      <div class="py-8 text-center text-gray-500">
        <i class="fa-solid fa-utensils mb-3 text-4xl text-gray-300"></i>
        <p class="font-medium">No meals logged today</p>
        <p class="text-sm">Add meals from the Meals page or scan products</p>
      </div>`;
    return;
  }

  listElement.innerHTML = items
    .map(
      (item) => `
        <div class="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-gray-900">${escapeHtml(item.name)}</p>
            <p class="text-xs text-gray-500">${escapeHtml(item.type)}${
              item.servings ? ` · ${displayNumber(item.servings)} ${item.servings === 1 ? "serving" : "servings"}` : ""
            } · ${
              item.nutritionKnown
                ? `${displayNumber(item.nutrients?.calories)} kcal`
                : item.nutritionDemo
                  ? "Demo estimate · not counted"
                  : "Nutrition unavailable"
            }</p>
          </div>
          <button type="button" data-remove-log="${escapeHtml(item.logId)}" aria-label="Remove ${escapeHtml(item.name)}" class="shrink-0 rounded-lg px-3 py-2 text-red-500 hover:bg-red-50">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>`,
    )
    .join("");
}

window.NutriPlanComponents = {
  renderCategories,
  renderFoodLog,
  renderMeals,
  renderProductCategories,
  renderProducts,
};
})();
