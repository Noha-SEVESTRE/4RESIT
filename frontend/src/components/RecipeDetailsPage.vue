<script setup lang="ts">
import { onMounted, ref } from "vue";
import RecipeDetailsPanel from "./RecipeDetailsPanel.vue";
import { getRecipe, type Recipe } from "../services/recipeService";
import { getStoredToken } from "../utils/authToken";
import {getErrorMessage} from "../utils/error.ts";

const props = defineProps<{
  recipeId: string;
}>();

const recipe = ref<Recipe | null>(null);
const errorMessage = ref("");
const isLoading = ref(true);

async function loadRecipe() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnectez-vous depuis SUPMEAL.";
    isLoading.value = false;
    return;
  }

  try {
    const response = await getRecipe(token, props.recipeId);
    recipe.value = response.recipe;
    document.title = `${response.recipe.title} - SUPMEAL`;
  } catch (error) {
    errorMessage.value = getErrorMessage(error,"Impossible de charger la recette.")
    document.title = "Détail recette - SUPMEAL";
  } finally {
    isLoading.value = false;
  }
}

function closeDetails() {
  window.close();
  window.location.href = "/";
}

onMounted(loadRecipe);
</script>

<template>
  <main class="recipe-detail-page">
    <header class="recipe-detail-topbar">
      <div>
        <p class="section-label">SUPMEAL</p>
        <h1>Détail de la recette</h1>
        <p>
          Retrouvez les informations complètes de la recette sélectionnée.
        </p>
      </div>
    </header>

    <p v-if="isLoading" class="recipe-info">
      Chargement de la recette...
    </p>

    <p v-else-if="errorMessage" class="recipe-error">
      {{ errorMessage }}
    </p>

    <RecipeDetailsPanel
        v-else-if="recipe"
        :recipe="recipe"
        @close="closeDetails"
    />
  </main>
</template>

<style scoped>
.recipe-detail-page {
  min-height: 100vh;
  padding: 36px;
  background: #f4eadb;
  display: grid;
  gap: 24px;
  align-content: start;
}

.recipe-detail-topbar {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding-bottom: 20px;
  border-bottom: 1px solid #decab0;
}

.recipe-detail-topbar .section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 13px;
}

.recipe-detail-topbar h1 {
  margin: 0 0 8px;
  color: #2f241d;
  font-size: 48px;
  line-height: 1.05;
  font-weight: 900;
}

.recipe-detail-topbar p:not(.section-label) {
  margin: 0;
  color: #5f5148;
  font-size: 18px;
  line-height: 1.5;
}

.recipe-detail-page :deep {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.recipe-info,
.recipe-error {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 12px 14px;
  border-radius: 14px;
  font-weight: 800;
}

.recipe-info {
  border: 1px solid #decab0;
  background: #fffaf2;
  color: #5f5148;
}

.recipe-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

@media (max-width: 800px) {
  .recipe-detail-page {
    padding: 20px;
  }

  .recipe-detail-topbar {
    flex-direction: column;
  }
}

.recipe-details-panel :deep(.section-label),
.recipe-details-panel .section-label {
  color: #ea580c;
  letter-spacing: 0.14em;
}
</style>