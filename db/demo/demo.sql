DROP DATABASE IF EXISTS qlhp_demo;
CREATE DATABASE qlhp_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qlhp_demo;

CREATE TABLE counter (
  id    INT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL,
  value INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO counter VALUES (1,'A',100),(2,'B',100);
