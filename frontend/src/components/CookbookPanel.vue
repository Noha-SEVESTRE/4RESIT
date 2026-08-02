<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getRecipes, type Recipe } from "../services/recipeService";
import {
  addCookbookMember,
  addRecipeToCookbook,
  createCookbook,
  deleteCookbook,
  getCookbook,
  getCookbookRecipes,
  getCookbooks,
  removeCookbookMember,
  removeRecipeFromCookbook,
  type Cookbook,
  type CookbookMember,
  type CookbookRecipe
} from "../services/cookbookService";
import CookbookMessagesPanel from "./CookbookMessagesPanel.vue";
import RecipeCommentsPanel from "./RecipeCommentsPanel.vue";

type CookbookRole = "OWNER" | "EDITOR" | "READER" | "COMMENTATOR";

const cookbooks = ref<Cookbook[]>([]);
const selectedCookbook = ref<Cookbook | null>(null);
const members = ref<CookbookMember[]>([]);
const cookbookRecipes = ref<CookbookRecipe[]>([]);
const personalRecipes = ref<Recipe[]>([]);
const name = ref("");
const description = ref("");
const memberEmail = ref("");
const memberRole = ref<CookbookRole>("READER");
const selectedRecipeId = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const recipeSearch = ref("");
const recipeTag = ref("");
const recipeIngredient = ref("");
const recipeMaxTotalTime = ref("");
const realtimeNotice = ref("");
const openedRecipeComments = ref<string | null>(null);

const canManageMembers = computed(() => selectedCookbook.value?.role === "OWNER");

const canEditCookbook = computed(() => {
  return selectedCookbook.value?.role === "OWNER" || selectedCookbook.value?.role === "EDITOR";
});

const canComment = computed(() => {
  const role = selectedCookbook.value?.role;

  return role === "OWNER" || role === "EDITOR" || role === "COMMENTATOR";
});

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

async function loadCookbooks() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getCookbooks(token);
    cookbooks.value = response.cookbooks;

    if (!selectedCookbook.value && response.cookbooks[0]) {
      await selectCookbook(response.cookbooks[0].id);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les cookbooks";
  } finally {
    isLoading.value = false;
  }
}

async function loadAvailableRecipes() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  try {
    const response = await getRecipes(token);
    const currentCookbookRecipeIds = new Set(cookbookRecipes.value.map((recipe) => recipe.id));

    personalRecipes.value = response.recipes.filter((recipe) => {
      return !currentCookbookRecipeIds.has(recipe.id);
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les recettes disponibles";
  }
}

async function loadCookbookRecipes() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  try {
    const response = await getCookbookRecipes(token, selectedCookbook.value.id, {
      q: recipeSearch.value || undefined,
      tag: recipeTag.value || undefined,
      ingredient: recipeIngredient.value || undefined,
      maxTotalTime: recipeMaxTotalTime.value ? Number(recipeMaxTotalTime.value) : undefined
    });

    cookbookRecipes.value = response.recipes;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les recettes du cookbook";
  }
}

async function selectCookbook(cookbookId: string) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  errorMessage.value = "";
  openedRecipeComments.value = null;

  try {
    const cookbookResponse = await getCookbook(token, cookbookId);

    selectedCookbook.value = cookbookResponse.cookbook;
    members.value = cookbookResponse.members ?? [];

    await loadCookbookRecipes();
    await loadAvailableRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger ce cookbook";
  }
}

async function submitCookbook() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!name.value.trim()) {
    errorMessage.value = "Le nom du cookbook est obligatoire";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    const response = await createCookbook(token, name.value.trim(), description.value.trim());

    name.value = "";
    description.value = "";

    await loadCookbooks();
    await selectCookbook(response.cookbook.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de créer le cookbook";
  } finally {
    isSaving.value = false;
  }
}

async function submitMember() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  if (!memberEmail.value.trim()) {
    errorMessage.value = "L'email du membre est obligatoire";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await addCookbookMember(
        token,
        selectedCookbook.value.id,
        memberEmail.value.trim(),
        memberRole.value
    );

    memberEmail.value = "";
    memberRole.value = "READER";

    await refreshSelectedCookbook();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter ce membre";
  } finally {
    isSaving.value = false;
  }
}

async function removeMember(member: CookbookMember) {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  const confirmed = window.confirm(`Retirer ${member.displayName} du cookbook ?`);

  if (!confirmed) {
    return;
  }

  try {
    await removeCookbookMember(token, selectedCookbook.value.id, member.id);
    await refreshSelectedCookbook();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de retirer ce membre";
  }
}

async function submitRecipeToCookbook() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  if (!selectedRecipeId.value) {
    errorMessage.value = "Choisis une recette à ajouter";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await addRecipeToCookbook(token, selectedCookbook.value.id, selectedRecipeId.value);

    selectedRecipeId.value = "";

    await refreshSelectedCookbook();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter cette recette";
  } finally {
    isSaving.value = false;
  }
}

async function removeRecipe(recipe: CookbookRecipe) {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  const confirmed = window.confirm(`Retirer "${recipe.title}" du cookbook ?`);

  if (!confirmed) {
    return;
  }

  try {
    await removeRecipeFromCookbook(token, selectedCookbook.value.id, recipe.id);

    if (openedRecipeComments.value === recipe.id) {
      openedRecipeComments.value = null;
    }

    await refreshSelectedCookbook();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de retirer cette recette";
  }
}

async function refreshSelectedCookbook() {
  if (!selectedCookbook.value) {
    return;
  }

  const selectedId = selectedCookbook.value.id;

  await loadCookbooks();
  await selectCookbook(selectedId);
}

async function resetRecipeFilters() {
  recipeSearch.value = "";
  recipeTag.value = "";
  recipeIngredient.value = "";
  recipeMaxTotalTime.value = "";

  await loadCookbookRecipes();
}

function openRecipeDetails(recipeId: string) {
  window.open(`${window.location.origin}/?recipeId=${recipeId}`, "_blank", "noopener,noreferrer");
}

function toggleRecipeComments(recipeId: string) {
  openedRecipeComments.value = openedRecipeComments.value === recipeId ? null : recipeId;
}

async function handleRealtimeCookbookUpdate() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  try {
    const cookbookResponse = await getCookbook(token, selectedCookbook.value.id);

    selectedCookbook.value = cookbookResponse.cookbook;
    members.value = cookbookResponse.members ?? [];

    await Promise.all([
      loadCookbooks(),
      loadCookbookRecipes(),
      loadAvailableRecipes()
    ]);

    window.setTimeout(() => {
      realtimeNotice.value = "";
    }, 2500);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger la mise à jour du cookbook";
  }
}

async function removeCookbook() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  if (selectedCookbook.value.role !== "OWNER") {
    errorMessage.value = "Seul le propriétaire peut supprimer ce cookbook";
    return;
  }

  const cookbookName = selectedCookbook.value.name;
  const confirmation = window.prompt(`Pour supprimer le cookbook "${cookbookName}", tape exactement son nom :`);

  if (confirmation === null) {
    return;
  }

  if (confirmation !== cookbookName) {
    errorMessage.value = "Le nom saisi ne correspond pas au nom du cookbook";
    return;
  }

  const confirmed = window.confirm(`Confirmer la suppression définitive du cookbook "${cookbookName}" ?`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteCookbook(token, selectedCookbook.value.id);

    selectedCookbook.value = null;
    members.value = [];
    cookbookRecipes.value = [];
    personalRecipes.value = [];
    openedRecipeComments.value = null;

    await loadCookbooks();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de supprimer ce cookbook";
  }
}

onMounted(async () => {
  await loadCookbooks();
});
</script>

<template>
  <section class="cookbook-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Cookbooks</p>
        <h3>Espaces partagés</h3>
      </div>

      <button class="secondary-button" type="button" @click="loadCookbooks">
        Actualiser
      </button>
    </div>

    <form class="cookbook-form" @submit.prevent="submitCookbook">
      <input v-model="name" type="text" placeholder="Nom du cookbook">
      <input v-model="description" type="text" placeholder="Description">

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Création..." : "Créer" }}
      </button>
    </form>

    <p v-if="errorMessage" class="recipe-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="recipe-info">
      Chargement des cookbooks...
    </p>

    <div class="cookbook-layout">
      <aside class="cookbook-list">
        <button
            v-for="cookbook in cookbooks"
            :key="cookbook.id"
            type="button"
            class="cookbook-list-button"
            :class="{ active: selectedCookbook?.id === cookbook.id }"
            @click="selectCookbook(cookbook.id)"
        >
          <strong>{{ cookbook.name }}</strong>
          <span>{{ cookbook.recipeCount }} recette{{ cookbook.recipeCount > 1 ? "s" : "" }} · {{ cookbook.role }}</span>
        </button>

        <p v-if="!cookbooks.length && !isLoading" class="recipe-info">
          Aucun cookbook créé.
        </p>
      </aside>

      <article v-if="selectedCookbook" class="cookbook-detail">
        <div class="cookbook-title-card">
          <div>
            <p class="section-label">{{ selectedCookbook.role }}</p>
            <h4>{{ selectedCookbook.name }}</h4>
            <p>{{ selectedCookbook.description || "Aucune description" }}</p>
          </div>

          <button
              v-if="selectedCookbook.role === 'OWNER'"
              class="danger-button"
              type="button"
              @click="removeCookbook"
          >
            Supprimer le cookbook
          </button>
        </div>

        <p v-if="realtimeNotice" class="success-message">
          {{ realtimeNotice }}
        </p>

        <div class="cookbook-block">
          <h5>Membres</h5>

          <form v-if="canManageMembers" class="member-form" @submit.prevent="submitMember">
            <input v-model="memberEmail" type="email" placeholder="email@supmeal.fr">

            <select v-model="memberRole">
              <option value="READER">Lecteur</option>
              <option value="COMMENTATOR">Commentateur</option>
              <option value="EDITOR">Éditeur</option>
            </select>

            <button type="submit" :disabled="isSaving">
              Ajouter
            </button>
          </form>

          <div class="member-list">
            <div v-for="member in members" :key="member.id" class="member-item">
              <div>
                <strong>{{ member.displayName }}</strong>
                <span>{{ member.email }} · {{ member.role }}</span>
              </div>

              <button
                  v-if="canManageMembers && member.role !== 'OWNER'"
                  class="danger-button"
                  type="button"
                  @click="removeMember(member)"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>

        <div class="cookbook-block">
          <div class="cookbook-block-header">
            <div>
              <h5>Recettes du cookbook</h5>
              <p>Recherche dédiée à ce cookbook.</p>
            </div>

            <button class="secondary-button" type="button" @click="loadCookbookRecipes">
              Actualiser
            </button>
          </div>

          <form class="recipe-filter-form" @submit.prevent="loadCookbookRecipes">
            <input v-model="recipeSearch" type="text" placeholder="Titre, étape, tag...">
            <input v-model="recipeTag" type="text" placeholder="Tag">
            <input v-model="recipeIngredient" type="text" placeholder="Ingrédient">
            <input v-model="recipeMaxTotalTime" type="number" min="0" placeholder="Temps max">

            <button type="submit">
              Rechercher
            </button>

            <button class="secondary-button" type="button" @click="resetRecipeFilters">
              Réinitialiser
            </button>
          </form>

          <form v-if="canEditCookbook" class="member-form" @submit.prevent="submitRecipeToCookbook">
            <select v-model="selectedRecipeId">
              <option value="">Choisir une recette</option>
              <option v-for="recipe in personalRecipes" :key="recipe.id" :value="recipe.id">
                {{ recipe.title }}
              </option>
            </select>

            <button type="submit" :disabled="isSaving">
              Ajouter la recette
            </button>
          </form>

          <div class="cookbook-recipes">
            <div v-for="recipe in cookbookRecipes" :key="recipe.id" class="cookbook-recipe-wrapper">
              <div
                  class="cookbook-recipe"
                  role="button"
                  tabindex="0"
                  @click="openRecipeDetails(recipe.id)"
                  @keydown.enter.prevent="openRecipeDetails(recipe.id)"
                  @keydown.space.prevent="openRecipeDetails(recipe.id)"
              >
                <div>
                  <strong>{{ recipe.title }}</strong>
                  <span>
                    {{ recipe.preparationTime + recipe.cookingTime }} min · {{ recipe.portions }} portion{{ recipe.portions > 1 ? "s" : "" }}
                  </span>

                  <div v-if="recipe.tags?.length" class="recipe-tags">
                    <small v-for="tag in recipe.tags" :key="tag">
                      {{ tag }}
                    </small>
                  </div>
                </div>

                <div class="cookbook-recipe-actions">
                  <button type="button" @click.stop="openRecipeDetails(recipe.id)">
                    Voir détails
                  </button>

                  <button type="button" @click.stop="toggleRecipeComments(recipe.id)">
                    {{ openedRecipeComments === recipe.id ? "Masquer" : "Commentaires" }}
                  </button>

                  <button
                      v-if="canEditCookbook"
                      class="danger-button"
                      type="button"
                      @click.stop="removeRecipe(recipe)"
                  >
                    Retirer
                  </button>
                </div>
              </div>

              <div v-if="openedRecipeComments === recipe.id" class="recipe-comments-area">
                <div class="recipe-comments-header">
                  <div>
                    <strong>Commentaires de la recette</strong>
                    <span>{{ recipe.title }}</span>
                  </div>
                </div>

                <RecipeCommentsPanel
                    :recipe-id="recipe.id"
                    :can-comment="canComment"
                    :role="selectedCookbook.role"
                />
              </div>
            </div>

            <p v-if="!cookbookRecipes.length" class="recipe-info">
              Aucune recette ne correspond à cette recherche.
            </p>
          </div>
        </div>

        <div class="cookbook-block">
          <CookbookMessagesPanel
              :cookbook-id="selectedCookbook.id"
              :role="selectedCookbook.role"
              :can-comment="canComment"
              @cookbook-updated="handleRealtimeCookbookUpdate"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.cookbook-panel {
  background: #fffdf8;
  border: 1px solid #decab0;
  border-radius: 28px;
  padding: 26px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.1);
  display: grid;
  gap: 22px;
}

.cookbook-form,
.member-form,
.recipe-filter-form {
  display: grid;
  gap: 12px;
}

.cookbook-form,
.member-form {
  grid-template-columns: 1fr 1fr auto;
}

.recipe-filter-form {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 16px;
  border: 1px solid #e2d2bd;
  border-radius: 20px;
  background: #fffaf2;
}

.cookbook-form {
  padding: 16px;
  border: 1px solid #e2d2bd;
  border-radius: 20px;
  background: #fffaf2;
}

.member-form {
  padding: 14px;
  border: 1px solid #e2d2bd;
  border-radius: 18px;
  background: #fffaf2;
}

.cookbook-form input,
.member-form input,
.member-form select,
.recipe-filter-form input {
  border: 1px solid #d9c7b2;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  background: #fffdf8;
  color: #2f241d;
}

.cookbook-form input:focus,
.member-form input:focus,
.member-form select:focus,
.recipe-filter-form input:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.cookbook-form button,
.member-form button,
.recipe-filter-form button,
.secondary-button,
.cookbook-recipe-actions button {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
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

.cookbook-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 22px;
  align-items: start;
}

.cookbook-list {
  display: grid;
  gap: 10px;
  align-content: start;
}

.cookbook-list button {
  border: 1px solid #d9c7b2;
  border-radius: 18px;
  padding: 15px;
  background: #fffaf2;
  color: #2f241d;
  text-align: left;
  display: grid;
  gap: 6px;
  cursor: pointer;
  box-shadow: none;
}

.cookbook-list button:hover {
  border-color: #d97706;
  background: #fff7ed;
}

.cookbook-list button.active {
  border-color: #d97706;
  background: #fff7ed;
  box-shadow: inset 4px 0 0 #d97706;
}

.cookbook-list strong {
  color: #2f241d;
  font-size: 16px;
  font-weight: 900;
}

.cookbook-list span,
.member-item span,
.cookbook-recipe span {
  color: #5f5148;
  font-size: 13px;
  font-weight: 700;
}

.cookbook-detail {
  display: grid;
  gap: 20px;
}

.cookbook-title-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 18px;
  border: 1px solid #e2d2bd;
  border-radius: 22px;
  background: #fffaf2;
}

.cookbook-detail h4 {
  margin: 0 0 8px;
  color: #2f241d;
  font-size: 24px;
}

.cookbook-detail p {
  color: #5f5148;
}

.cookbook-block {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e2d2bd;
  border-radius: 22px;
  background: #fffdf8;
}

.cookbook-block h5 {
  margin: 0;
  color: #2f241d;
  font-size: 17px;
}

.cookbook-block-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.cookbook-block-header p {
  margin: 4px 0 0;
  color: #5f5148;
  font-size: 14px;
  font-weight: 600;
}

.member-list,
.cookbook-recipes {
  display: grid;
  gap: 10px;
}

.member-item,
.cookbook-recipe {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border: 1px solid #d9c7b2;
  border-radius: 16px;
  padding: 13px 14px;
  background: #fffaf2;
}

.member-item div,
.cookbook-recipe div {
  display: grid;
  gap: 4px;
}

.member-item strong,
.cookbook-recipe strong {
  color: #2f241d;
  font-size: 15px;
  font-weight: 900;
}

.recipe-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.recipe-tags small {
  background: #e8f8ef;
  color: #047857;
  border: 1px solid #bfead2;
  border-radius: 999px;
  padding: 4px 9px;
  font-weight: 900;
}

.danger-button {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
  cursor: pointer;
  background: #fff1f2;
  color: #be123c;
  box-shadow: none;
}

.recipe-error {
  margin: 0;
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

.success-message {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #bbf7d0;
  background: #ecfdf5;
  color: #047857;
  font-weight: 900;
}

.cookbook-recipe-wrapper {
  display: grid;
  gap: 10px;
}

.cookbook-recipe {
  cursor: pointer;
}

.cookbook-recipe:hover {
  border-color: #d97706;
  background: #fff7ed;
}

.cookbook-recipe:focus-visible {
  outline: 3px solid rgba(217, 119, 6, 0.25);
  outline-offset: 3px;
}

.cookbook-recipe-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
}

.cookbook-recipe-actions .danger-button {
  background: #fff1f2;
  color: #be123c;
}

.recipe-comments-area {
  margin-left: 16px;
  padding: 14px;
  border: 1px solid #decab0;
  border-radius: 18px;
  background: #fffaf2;
  display: grid;
  gap: 12px;
}

.recipe-comments-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.recipe-comments-header strong {
  color: #2f241d;
  font-size: 15px;
  font-weight: 900;
}

.recipe-comments-header span {
  color: #5f5148;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .cookbook-layout {
    grid-template-columns: 1fr;
  }

  .cookbook-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recipe-filter-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .cookbook-block-header,
  .member-item,
  .cookbook-recipe,
  .cookbook-title-card {
    flex-direction: column;
    align-items: stretch;
  }

  .cookbook-block-header,
  .member-item,
  .cookbook-recipe {
    flex-direction: column;
    align-items: stretch;
  }

  .recipe-comments-area {
    margin-left: 0;
  }

  .cookbook-recipe-actions {
    justify-content: flex-start;
  }
}
</style>