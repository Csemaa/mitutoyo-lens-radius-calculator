//calculate radius in mm
export const calculateRadius = (sagitta: number, diameter: number, lensType: 'minus' | 'plus') => {
	return lensType === 'minus'
		? -(sagitta / 2 + Math.pow(diameter, 2) / (8 * sagitta))
		: sagitta / 2 + Math.pow(diameter, 2) / (8 * sagitta);
};

//calculate saggita in mm
export const calculateSagitta = (radius: number, diameter: number) => {
	const halfChord = diameter / 2;
	return radius - Math.sqrt(Math.pow(radius, 2) - Math.pow(halfChord, 2));
};
