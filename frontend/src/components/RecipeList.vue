<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  addRecipeToFavorites,
  deleteRecipe,
  exportRecipe,
  getRecipe,
  getRecipes,
  importRecipe,
  removeRecipeFromFavorites,
  type ExportedRecipe,
  type Recipe
} from "../services/recipeService";
import RecipeCommentsPanel from "./RecipeCommentsPanel.vue";
import { getCookbooks, type Cookbook } from "../services/cookbookService";

const emit = defineEmits<{
  edit: [recipe: Recipe];
}>();

const recipes = ref<Recipe[]>([]);
const search = ref("");
const tag = ref("");
const ingredient = ref("");
const maxTotalTime = ref("");
const onlyFavorites = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const openedComments = ref<string | null>(null);
const importInput = ref<HTMLInputElement | null>(null);
const cookbooks = ref<Cookbook[]>([]);
const selectedCookbookId = ref("");

const hasRecipes = computed(() => recipes.value.length > 0);

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function toggleComments(recipeId: string) {
  openedComments.value = openedComments.value === recipeId ? null : recipeId;
}

function buildExportFileName(recipe: Recipe) {
  return `${recipe.title.toLowerCase().replaceAll(" ", "-")}-supmeal.json`;
}

function downloadJsonFile(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function openImportFile() {
  importInput.value?.click();
}

async function loadCookbookOptions() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  try {
    const response = await getCookbooks(token);
    cookbooks.value = response.cookbooks;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les cookbooks";
  }
}

async function exportCurrentRecipe(recipe: Recipe) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  try {
    const exportedRecipe = await exportRecipe(token, recipe.id);
    downloadJsonFile(buildExportFileName(recipe), exportedRecipe);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'exporter la recette";
  }
}

async function importRecipeFile(event: Event) {
  const token = getStoredToken();
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!file) {
    return;
  }

  try {
    const content = await file.text();
    const payload = JSON.parse(content) as ExportedRecipe;

    await importRecipe(token, payload);
    input.value = "";
    await loadRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'importer la recette";
  }
}

async function loadRecipes() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getRecipes(token, {
      q: search.value || undefined,
      tag: tag.value || undefined,
      ingredient: ingredient.value || undefined,
      cookbookId: selectedCookbookId.value || undefined,
      maxTotalTime: maxTotalTime.value ? Number(maxTotalTime.value) : undefined,
      favorite: onlyFavorites.value ? "true" : undefined
    });

    recipes.value = response.recipes;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les recettes";
  } finally {
    isLoading.value = false;
  }
}

async function toggleFavorite(recipe: Recipe) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  try {
    if (recipe.isFavorite) {
      await removeRecipeFromFavorites(token, recipe.id);
    } else {
      await addRecipeToFavorites(token, recipe.id);
    }

    await loadRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de modifier le favori";
  }
}

async function editRecipe(recipeId: string) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  try {
    const response = await getRecipe(token, recipeId);
    emit("edit", response.recipe);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger la recette";
  }
}

async function removeRecipe(recipe: Recipe) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const confirmed = window.confirm(`Supprimer la recette "${recipe.title}" ?`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteRecipe(token, recipe.id);
    await loadRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de supprimer la recette";
  }
}

function resetFilters() {
  search.value = "";
  tag.value = "";
  ingredient.value = "";
  selectedCookbookId.value = "";
  maxTotalTime.value = "";
  onlyFavorites.value = false;
  loadRecipes();
}

onMounted(async () => {
  await Promise.all([
    loadCookbookOptions(),
    loadRecipes()
  ]);
});
</script>

<template>
  <section class="recipe-list">
    <div class="recipe-list-header">
      <div>
        <p class="section-label">Mes recettes</p>
        <h2>Recettes enregistrées</h2>
      </div>

      <div class="recipe-header-actions">
        <input
            ref="importInput"
            type="file"
            accept="application/json"
            class="hidden-file-input"
            @change="importRecipeFile"
        >

        <button class="secondary-button" type="button" @click="openImportFile">
          Importer
        </button>

        <button class="secondary-button" type="button" @click="loadRecipes">
          Actualiser
        </button>
      </div>
    </div>

    <form class="recipe-filters" @submit.prevent="loadRecipes">
      <input v-model="search" type="text" placeholder="Rechercher titre, étape, tag..." />
      <input v-model="tag" type="text" placeholder="Tag" />
      <input v-model="ingredient" type="text" placeholder="Ingrédient" />

      <select v-model="selectedCookbookId">
        <option value="">Tous les cookbooks</option>
        <option value="personal">Recettes personnelles</option>
        <option v-for="cookbook in cookbooks" :key="cookbook.id" :value="cookbook.id">
          {{ cookbook.name }}
        </option>
      </select>

      <input v-model="maxTotalTime" type="number" min="0" placeholder="Temps max" />

      <label class="favorite-filter">
        <input v-model="onlyFavorites" type="checkbox" @change="loadRecipes" />
        Favoris uniquement
      </label>

      <button type="submit">
        Filtrer
      </button>

      <button class="secondary-button" type="button" @click="resetFilters">
        Réinitialiser
      </button>
    </form>

    <p v-if="errorMessage" class="recipe-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="recipe-info">
      Chargement des recettes...
    </p>

    <p v-else-if="!hasRecipes" class="recipe-info">
      Aucune recette trouvée.
    </p>

    <div v-else class="recipe-grid">
      <article v-for="recipe in recipes" :key="recipe.id" class="recipe-card">
        <img
            v-if="recipe.imageUrl"
            class="recipe-card-image"
            :src="recipe.imageUrl"
            :alt="recipe.title"
        >

        <div class="recipe-card-top">
          <h3>{{ recipe.title }}</h3>

          <button class="favorite-button" type="button" @click="toggleFavorite(recipe)">
            {{ recipe.isFavorite ? "★" : "☆" }}
          </button>
        </div>

        <p class="recipe-description">
          {{ recipe.description || "Aucune description" }}
        </p>

        <div class="recipe-meta">
          <span>{{ recipe.preparationTime + recipe.cookingTime }} min</span>
          <span>{{ recipe.portions }} portion{{ recipe.portions > 1 ? "s" : "" }}</span>
          <span v-if="recipe.cookbookId">Cookbook</span>
        </div>

        <div v-if="recipe.tags?.length" class="recipe-tags">
          <span v-for="recipeTag in recipe.tags" :key="recipeTag">
            {{ recipeTag }}
          </span>
        </div>

        <div class="recipe-actions">
          <button type="button" @click="toggleComments(recipe.id)">
            Commentaires
          </button>

          <button type="button" @click="exportCurrentRecipe(recipe)">
            Exporter
          </button>

          <button type="button" @click="editRecipe(recipe.id)">
            Modifier
          </button>

          <button class="danger-button" type="button" @click="removeRecipe(recipe)">
            Supprimer
          </button>
        </div>

        <RecipeCommentsPanel
            v-if="openedComments === recipe.id"
            :recipe-id="recipe.id"
        />
      </article>
    </div>
  </section>
</template>

<style scoped>
.recipe-list {
  display: grid;
  gap: 24px;
}

.recipe-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-label {
  margin: 0 0 4px;
  color: #f97316;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.recipe-list h2 {
  margin: 0;
}

.recipe-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: center;
}

.recipe-filters input,
.recipe-filters select {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  background: white;
}

.recipe-filters button,
.secondary-button {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  font-weight: 800;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f3f4f6;
  color: #111827;
}

.favorite-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.favorite-filter input {
  width: auto;
}

.recipe-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

.recipe-info {
  margin: 0;
  color: #6b7280;
  font-weight: 700;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.recipe-card {
  border: 1px solid #e5e7eb;
  border-radius: 22px;
  padding: 20px;
  background: white;
  display: grid;
  gap: 14px;
}

.recipe-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.recipe-card h3 {
  margin: 0;
}

.favorite-button {
  border: 0;
  background: #fff7ed;
  color: #f97316;
  border-radius: 999px;
  width: 38px;
  height: 38px;
  cursor: pointer;
  font-size: 22px;
}

.recipe-description {
  margin: 0;
  color: #6b7280;
}

.recipe-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.recipe-meta span {
  background: #f3f4f6;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 700;
}

.recipe-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recipe-tags span {
  background: #ecfdf5;
  color: #047857;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 800;
}

.recipe-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.recipe-actions button {
  border: 0;
  border-radius: 999px;
  padding: 9px 12px;
  font-weight: 800;
  cursor: pointer;
  background: #f3f4f6;
  color: #111827;
}

.recipe-actions .danger-button {
  background: #fff1f2;
  color: #be123c;
}

@media (max-width: 900px) {
  .recipe-filters,
  .recipe-grid {
    grid-template-columns: 1fr;
  }

  .recipe-list-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

.recipe-header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hidden-file-input {
  display: none;
}

.recipe-card-image {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}
</style>