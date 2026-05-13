import { Request, Response } from "express";
import {
  login,
  registerMember,
  requestPasswordReset,
  resetPasswordWithCode,
} from "../services/auth.service";

export const register = async (req: Request, res: Response) => {
  try {
    const result = await registerMember(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Registration failed",
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
};

export const requestForgotPassword = async (req: Request, res: Response) => {
  try {
    const result = await requestPasswordReset(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Password reset request failed",
    });
  }
};

export const resetForgotPassword = async (req: Request, res: Response) => {
  try {
    const result = await resetPasswordWithCode(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Password reset failed",
    });
  }
};
