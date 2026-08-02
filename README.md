# 🍳 Mom's Recipes

A personal recipe website built with **Next.js** to store, organize, and share my mom’s recipes.

The goal of this project is to digitize family recipes and make them easy to browse and search through. My mom will also be able to log in and upload her own recipes directly to the website.

---

## ✨ Features

- 📖 Browse a list of recipes
- 🔍 Search through recipes
- 🔐 Secure login for my mom
- ➕ Upload new recipes
- 📱 Responsive design for mobile and desktop

_This is the goal. What actually exists today is listed under Built, below._

---

## 🧠 Project Goal

This project aims to preserve family recipes by turning them into a searchable online cookbook. Instead of keeping recipes scattered across notebooks or papers, everything will live in one simple and accessible website.

---

## 🛠️ Tech Stack

- **Framework:** Next.js
- **Language:** JavaScript / TypeScript
- **Styling:** CSS / Tailwind
- **Authentication:** supabase
- **Database:** supabase

---

## ✅ Built

- Browsing recipes, and a recipe page with its ingredients and method
- Login, and an admin area behind it
- Creating a recipe through a four-step wizard with a live preview
- Managing recipes: publish, unpublish, delete, and preview a draft before it goes live

## 📂 Planned Features

- **Editing an existing recipe.** The wizard was placed and shaped to be reused for it; the write
  path already branches on an id.
- **Recipe images.** Blocked on there being no Storage bucket at all — see
  [docs/image-storage.md](docs/image-storage.md).
- **Recipe tags.** `/admin/tags` is a placeholder with no schema behind it yet.
- **Search filters.** There is no search of any kind yet.

---

### Clone the repository

```bash
git clone https://github.com/yourusername/moms-recipes.git
cd moms-recipes
```
