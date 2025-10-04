import React from "react";

/**
 * Catalogue mobile-first inspiré de WhatsApp Business
 *
 * Props:
 * - categories: Array<{
 *     id: string;
 *     title: string;
 *     products: Array<{
 *       id: string;
 *       name: string;
 *       price: number | string;
 *       description?: string;
 *       image?: string;
 *     }>
 *   }>
 * - onAdd?: (product) => void   // callback lorsqu'on clique sur le bouton + d'un produit
 * - onViewAll?: (category) => void  // callback bouton "Voir tout" par catégorie
 *
 * Notes UI/UX:
 * - Dark mode par défaut (bg-gray-900 text-white)
 * - Mobile-first compact, sans marges fixes -> s'adapte à la largeur parente
 * - Sur écrans larges: grille 2 colonnes par catégorie
 */
const Catalogue = ({ categories = [], onAdd = () => {}, onViewAll = () => {} }) => {
  return (
    <div className="w-full bg-gray-900 text-white">
      <div className="w-full">
        {categories.map((cat) => (
          <section key={cat.id} className="w-full">
            {/* En-tête catégorie */}
            <div className="flex items-center justify-between px-3 sm:px-4 pt-4">
              <h3 className="text-sm font-semibold truncate pr-2">{cat.title}</h3>
              <button
                type="button"
                onClick={() => onViewAll(cat)}
                className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800 active:bg-gray-700 transition-colors"
              >
                Voir tout
              </button>
            </div>

            {/* Liste des produits */}
            <div
              className="px-1 sm:px-2 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-2"
              aria-label={`Produits de la catégorie ${cat.title}`}
            >
              {cat.products?.map((p) => (
                <article
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  {/* Image */}
                  <div className="shrink-0">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-14 h-14 rounded-md object-cover bg-gray-700"
                        onError={(e) => {
                          e.currentTarget.src = "/img/default.png";
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-gray-700" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-300">{typeof p.price === "number" ? p.price.toLocaleString() : p.price} FCFA</div>
                    {p.description && (
                      <div className="text-xs text-gray-400 truncate">{p.description}</div>
                    )}
                  </div>

                  {/* Action + */}
                  <div className="pl-1">
                    <button
                      type="button"
                      aria-label={`Ajouter ${p.name}`}
                      onClick={() => onAdd(p)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-500 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-900"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                        aria-hidden="true"
                      >
                        <path d="M12 5c.552 0 1 .448 1 1v5h5c.552 0 1 .448 1 1s-.448 1-1 1h-5v5c0 .552-.448 1-1 1s-1-.448-1-1v-5H6c-.552 0-1-.448-1-1s.448-1 1-1h5V6c0-.552.448-1 1-1z" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default Catalogue;
