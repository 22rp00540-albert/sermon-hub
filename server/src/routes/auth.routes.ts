import { Router } from "express";
import {
  loginUser,
  register,
  requestForgotPassword,
  resetForgotPassword,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", loginUser);
router.post("/forgot-password/request", requestForgotPassword);
router.post("/forgot-password/reset", resetForgotPassword);

export default router;
