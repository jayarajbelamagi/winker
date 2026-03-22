import jwt from "jsonwebtoken";
import { getJwtCookieOptions } from "./cookieOptions.js";

export const generateTokenAndSetCookie = (userId, res) => {
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "15d",
	});

	res.cookie("jwt", token, getJwtCookieOptions());
};
