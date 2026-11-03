import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import AuthLayout from "../layouts/AuthLayout";
import GuestRoute from "./GuestRoute";
import Login from "../features/auth/Login";
import Register from "../features/auth/Register";
import VerificationCode from "../features/auth/VerifyCode";
import ChangeMobile from "../features/auth/ChangeMobile";
import ForgotPassword from "../features/auth/ForgotPassword";
import PasswordResetOtp from "../features/auth/PasswordResetOtp";
import ScanFace from "../features/auth/ScanFace";
import VerifyDocument from "../features/auth/VerifyDocument";
import NewPassword from "../features/auth/NewPassword";

export const authRoutes = (
  <Route element={<GuestRoute />}>
    <Route element={<AuthLayout />}>
      <Route path={PATHS.login} element={<Login />} />
      <Route path={PATHS.register} element={<Register />} />
      <Route path={PATHS.changeMobile} element={<ChangeMobile />} />
      <Route path={PATHS.verify} element={<VerificationCode />} />
      <Route path={PATHS.forgotPassword} element={<ForgotPassword />} />
      <Route path={PATHS.resetPassword} element={<PasswordResetOtp />} />
      <Route path={PATHS.newPassword} element={<NewPassword />} />
      <Route path={PATHS.scanFace} element={<ScanFace />} />
      <Route path={PATHS.verifyDocument} element={<VerifyDocument />} />
    </Route>
  </Route>
);