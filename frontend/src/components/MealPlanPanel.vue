<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getRecipes, type Recipe } from "../services/recipeService";
import { createMealPlan, deleteMealPlan, getMealPlans, type MealPlan } from "../services/mealPlanService";
import { getCookbooks, getCookbookRecipes } from "../services/cookbookService";

const recipes = ref<Recipe[]>([]);
const mealPlans = ref<MealPlan[]>([]);
const selectedRecipeId = ref("");
const plannedDate = ref("");
const mealType = ref("dîner");
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const shareWithCookbook = ref(false);

const hasMealPlans = computed(() => mealPlans.value.length > 0);

const selectedRecipe = computed(() =>
    recipes.value.find((recipe) => recipe.id === selectedRecipeId.value)
);

const canShareWithCookbook = computed(() =>
    Boolean(selectedRecipe.value?.cookbookId)
);

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function openRecipeDetails(recipeId: string) {
  window.open(`${window.location.origin}/?recipeId=${recipeId}`, "_blank", "noopener,noreferrer");
}

async function loadData() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const [recipesResponse, cookbooksResponse, mealPlansResponse] = await Promise.all([
      getRecipes(token),
      getCookbooks(token),
      getMealPlans(token)
    ]);

    const cookbookRecipesResponses = await Promise.all(
        cookbooksResponse.cookbooks.map((cookbook) =>
            getCookbookRecipes(token, cookbook.id)
        )
    );

    const allRecipes = [
      ...recipesResponse.recipes,
      ...cookbookRecipesResponses.flatMap((response) => response.recipes)
    ];

    recipes.value = Array.from(
        new Map(allRecipes.map((recipe) => [recipe.id, recipe])).values()
    );

    mealPlans.value = mealPlansResponse.mealPlans;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger le planning";
  } finally {
    isLoading.value = false;
  }
}

async function submitMealPlan() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!selectedRecipeId.value) {
    errorMessage.value = "Choisis une recette à planifier";
    return;
  }

  if (!plannedDate.value) {
    errorMessage.value = "Choisis une date";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await createMealPlan(token, {
      recipeId: selectedRecipeId.value,
      plannedDate: plannedDate.value,
      mealType: mealType.value,
      shareWithCookbook: canShareWithCookbook.value && shareWithCookbook.value
    });

    selectedRecipeId.value = "";
    plannedDate.value = "";
    mealType.value = "dîner";
    shareWithCookbook.value = false;

    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter ce repas au planning";
  } finally {
    isSaving.value = false;
  }
}

async function removeMealPlan(mealPlan: MealPlan) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const confirmed = window.confirm(`Retirer "${mealPlan.recipe.title}" du planning ?`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteMealPlan(token, mealPlan.id);
    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de retirer ce repas du planning";
  }
}

onMounted(loadData);
</script>

<template>
  <article class="panel meal-plan-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Planning</p>
        <h3>Repas prévus</h3>
      </div>

      <button class="secondary-button" type="button" @click="loadData">
        Actualiser
      </button>
    </div>

    <form class="meal-plan-form" @submit.prevent="submitMealPlan">
      <select v-model="selectedRecipeId">
        <option value="">Choisir une recette</option>
        <option v-for="recipe in recipes" :key="recipe.id" :value="recipe.id">
          {{ recipe.title }}
        </option>
      </select>

      <input v-model="plannedDate" type="date">

      <select v-model="mealType">
        <option value="petit-déjeuner">Petit-déjeuner</option>
        <option value="déjeuner">Déjeuner</option>
        <option value="dîner">Dîner</option>
        <option value="collation">Collation</option>
      </select>

      <label v-if="canShareWithCookbook" class="share-planning">
        <input v-model="shareWithCookbook" type="checkbox">
        Partager avec le cookbook
      </label>

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Ajout..." : "Planifier" }}
      </button>
    </form>

    <p v-if="errorMessage" class="recipe-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="recipe-info">
      Chargement du planning...
    </p>

    <p v-else-if="!hasMealPlans" class="recipe-info">
      Aucun repas planifié.
    </p>

    <div v-else class="list">
      <div
          v-for="plan in mealPlans"
          :key="plan.id"
          class="list-item meal-plan-item"
          role="button"
          tabindex="0"
          @click="openRecipeDetails(plan.recipe.id)"
          @keydown.enter.prevent="openRecipeDetails(plan.recipe.id)"
          @keydown.space.prevent="openRecipeDetails(plan.recipe.id)"
      >
        <div>
          <strong>{{ formatDate(plan.plannedDate) }} · {{ plan.mealType }}</strong>
          <span>{{ plan.recipe.title }}</span>
        </div>

        <button class="delete-plan-button" type="button" @click.stop="removeMealPlan(plan)">
          Retirer
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.meal-plan-panel {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  border: 1px solid #c9ad8d;
  background: #fffaf2;
  box-shadow: 0 22px 65px rgba(44, 32, 24, 0.14);
}

.meal-plan-form {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 12px;
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid #c9ad8d;
  border-radius: 20px;
  background: #fff4e6;
}

.meal-plan-form input,
.meal-plan-form select {
  border: 1px solid #c9ad8d;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  background: #fffdf8;
  color: #2f241d;
}

.meal-plan-form input:focus,
.meal-plan-form select:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.meal-plan-form button,
.secondary-button {
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  min-height: 36px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
}

.recipe-error {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 800;
}

.recipe-info {
  margin: 0;
  color: #5f5148;
  font-weight: 800;
}

.delete-plan-button {
  width: auto;
  min-width: 0;
  height: 34px;
  border: 1px solid #f3c6cf;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  background: #fff1f4;
  color: #be123c;
  align-self: center;
  white-space: nowrap;
  box-shadow: none;
  line-height: 1;
}

.delete-plan-button:hover {
  background: #ffe4ea;
}

:deep(.list-item) {
  border: 1px solid #c9ad8d;
  background: #fffaf2;
  box-shadow: 0 8px 20px rgba(44, 32, 24, 0.06);
}

:deep(.list-item strong) {
  color: #2f241d;
}

:deep(.list-item span) {
  color: #5f5148;
  font-weight: 700;
}

.meal-plan-item {
  cursor: pointer;
}

.meal-plan-item:hover {
  border-color: #d97706;
  background: #fff7ed;
}

.meal-plan-item:focus-visible {
  outline: 3px solid rgba(217, 119, 6, 0.25);
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .meal-plan-form {
    grid-template-columns: 1fr;
  }
}

.share-planning {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #2f241d;
}

.share-planning input {
  width: auto;
  margin: 0;
}
</style>