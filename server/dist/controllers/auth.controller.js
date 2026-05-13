"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetForgotPassword = exports.requestForgotPassword = exports.loginUser = exports.register = void 0;
const auth_service_1 = require("../services/auth.service");
const register = async (req, res) => {
    try {
        const result = await (0, auth_service_1.registerMember)(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({
            message: error instanceof Error ? error.message : "Registration failed",
        });
    }
};
exports.register = register;
const loginUser = async (req, res) => {
    try {
        const result = await (0, auth_service_1.login)(req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(400).json({
            message: error instanceof Error ? error.message : "Login failed",
        });
    }
};
exports.loginUser = loginUser;
const requestForgotPassword = async (req, res) => {
    try {
        const result = await (0, auth_service_1.requestPasswordReset)(req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(400).json({
            message: error instanceof Error ? error.message : "Password reset request failed",
        });
    }
};
exports.requestForgotPassword = requestForgotPassword;
const resetForgotPassword = async (req, res) => {
    try {
        const result = await (0, auth_service_1.resetPasswordWithCode)(req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(400).json({
            message: error instanceof Error ? error.message : "Password reset failed",
        });
    }
};
exports.resetForgotPassword = resetForgotPassword;
