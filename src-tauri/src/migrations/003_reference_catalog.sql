CREATE TABLE reference_catalog (
    catalog TEXT NOT NULL,
    id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (catalog, id)
);
